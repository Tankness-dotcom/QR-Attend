const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const QRCode   = require('qrcode');
const { all, get, insert, run } = require('../database');
const { authMiddleware, studentAuthMiddleware } = require('../middleware/auth');

const router = express.Router();

/* ── helpers ── */
const NEW_FIELDS = ['phone', 'lrn', 'grade_level', 'section', 'student_code'];

function pickFields(src) {
  return {
    phone:        src.phone        || null,
    lrn:          src.lrn          || null,
    grade_level:  src.grade_level  || null,
    section:      src.section      || null,
    student_code: src.student_code || null,
  };
}

/* ════════════════════════════════════
   STUDENT SELF-SERVICE
═══════════════════════════════════════ */

// GET /api/students/me
router.get('/me', studentAuthMiddleware, (req, res) => {
  const student = get(`
    SELECT s.*, c.name as class_name, c.subject
    FROM students s
    JOIN classes c ON s.class_id = c.id
    WHERE s.id = ?
  `, [req.student.studentRowId]);

  if (!student) return res.status(404).json({ error: 'Student not found' });

  const attendance = all(`
    SELECT a.id, a.date, a.scanned_at, a.status, c.name as class_name
    FROM attendance a
    JOIN classes c ON a.class_id = c.id
    WHERE a.student_id = ?
    ORDER BY a.date DESC
  `, [req.student.studentRowId]);

  const classDates   = all('SELECT DISTINCT date FROM attendance WHERE class_id = ?', [student.class_id]);
  const presentDates = new Set(attendance.filter(a => a.status === 'present').map(a => a.date));
  const totalSessions = classDates.length;
  const totalPresent  = presentDates.size;
  const totalAbsent   = totalSessions - totalPresent;

  res.json({ student, attendance, summary: { totalSessions, totalPresent, totalAbsent } });
});

// GET /api/students/me/qr
router.get('/me/qr', studentAuthMiddleware, async (req, res) => {
  const student = get('SELECT * FROM students WHERE id = ?', [req.student.studentRowId]);
  if (!student) return res.status(404).json({ error: 'Not found' });

  try {
    const qr = await QRCode.toDataURL(student.qr_token, {
      errorCorrectionLevel: 'H', width: 320, margin: 2,
      color: { dark: '#3e6f5c', light: '#ffffff' }
    });
    res.json({ qr, student_name: student.name, student_id: student.student_id, qr_token: student.qr_token });
  } catch {
    res.status(500).json({ error: 'QR generation failed' });
  }
});

/* ════════════════════════════════════
   TEACHER ROUTES
═══════════════════════════════════════ */
router.use(authMiddleware);

// GET /api/students?class_id=X
router.get('/', (req, res) => {
  const { class_id } = req.query;

  if (class_id) {
    const cls = get('SELECT id FROM classes WHERE id = ? AND teacher_id = ?', [class_id, req.teacher.id]);
    if (!cls) return res.status(403).json({ error: 'Access denied' });

    const students = all(`
      SELECT s.id, s.name, s.student_id, s.email, s.phone, s.lrn,
             s.grade_level, s.section, s.student_code, s.qr_token, s.created_at,
             (SELECT COUNT(*) FROM student_accounts sa WHERE sa.student_id = s.id) as has_account
      FROM students s WHERE s.class_id = ? ORDER BY s.name
    `, [class_id]);
    return res.json(students);
  }

  const students = all(`
    SELECT s.id, s.name, s.student_id, s.email, s.phone, s.lrn,
           s.grade_level, s.section, s.student_code, s.qr_token, s.created_at,
           c.name as class_name,
           (SELECT COUNT(*) FROM student_accounts sa WHERE sa.student_id = s.id) as has_account
    FROM students s
    JOIN classes c ON s.class_id = c.id
    WHERE c.teacher_id = ?
    ORDER BY c.name, s.name
  `, [req.teacher.id]);
  res.json(students);
});

// POST /api/students
router.post('/', (req, res) => {
  const { class_id, name, student_id, email } = req.body;
  if (!class_id || !name || !student_id)
    return res.status(400).json({ error: 'class_id, name, and student_id are required' });

  const cls = get('SELECT id FROM classes WHERE id = ? AND teacher_id = ?', [class_id, req.teacher.id]);
  if (!cls) return res.status(403).json({ error: 'Access denied' });

  const dup = get('SELECT id FROM students WHERE student_id = ?', [student_id]);
  if (dup) return res.status(409).json({ error: 'Student ID already exists' });

  const extra  = pickFields(req.body);
  const qr_token = uuidv4();

  const id = insert(
    `INSERT INTO students
       (class_id, name, student_id, email, phone, lrn, grade_level, section, student_code, qr_token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [class_id, name, student_id, email || null,
     extra.phone, extra.lrn, extra.grade_level, extra.section, extra.student_code,
     qr_token]
  );
  res.status(201).json({ id, name, student_id, email, ...extra, qr_token, class_id });
});

// POST /api/students/bulk
// CSV column order: name, student_id, email, phone, lrn, grade_level, section, student_code
router.post('/bulk', (req, res) => {
  const { class_id, students } = req.body;
  if (!class_id || !Array.isArray(students) || !students.length)
    return res.status(400).json({ error: 'class_id and students array are required' });

  const cls = get('SELECT id FROM classes WHERE id = ? AND teacher_id = ?', [class_id, req.teacher.id]);
  if (!cls) return res.status(403).json({ error: 'Access denied' });

  const created = [];
  for (const s of students) {
    if (!s.name || !s.student_id) continue;
    if (get('SELECT id FROM students WHERE student_id = ?', [s.student_id])) continue;
    const extra    = pickFields(s);
    const qr_token = uuidv4();
    try {
      const id = insert(
        `INSERT INTO students
           (class_id, name, student_id, email, phone, lrn, grade_level, section, student_code, qr_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [class_id, s.name, s.student_id, s.email || null,
         extra.phone, extra.lrn, extra.grade_level, extra.section, extra.student_code,
         qr_token]
      );
      created.push({ id, name: s.name, student_id: s.student_id, ...extra, qr_token });
    } catch {}
  }
  res.status(201).json({ created: created.length, students: created });
});

// GET /api/students/:id/qr
router.get('/:id/qr', async (req, res) => {
  const student = get(`
    SELECT s.*, c.teacher_id FROM students s
    JOIN classes c ON s.class_id = c.id WHERE s.id = ?
  `, [req.params.id]);

  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (student.teacher_id !== req.teacher.id) return res.status(403).json({ error: 'Access denied' });

  try {
    const qr = await QRCode.toDataURL(student.qr_token, {
      errorCorrectionLevel: 'H', width: 300, margin: 2,
      color: { dark: '#3e6f5c', light: '#ffffff' }
    });
    res.json({ qr, student_name: student.name, student_id: student.student_id, qr_token: student.qr_token });
  } catch {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// DELETE /api/students/:id
router.delete('/:id', (req, res) => {
  const student = get(`
    SELECT s.id, c.teacher_id FROM students s
    JOIN classes c ON s.class_id = c.id WHERE s.id = ?
  `, [req.params.id]);

  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (student.teacher_id !== req.teacher.id) return res.status(403).json({ error: 'Access denied' });

  run('DELETE FROM student_accounts WHERE student_id = ?', [req.params.id]);
  run('DELETE FROM attendance WHERE student_id = ?', [req.params.id]);
  run('DELETE FROM students WHERE id = ?', [req.params.id]);
  res.json({ message: 'Student deleted' });
});

module.exports = router;
