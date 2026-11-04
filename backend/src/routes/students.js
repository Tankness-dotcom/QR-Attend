const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const QRCode   = require('qrcode');
const { all, get, insert, run } = require('../database');
const { authMiddleware, studentAuthMiddleware } = require('../middleware/auth');

const router = express.Router();

/* ─────────────────────────────────────
   helpers
───────────────────────────────────── */
// Returns true when the requesting teacher is an admin
const isAdmin = (req) => req.teacher?.role === 'admin';

// Ownership check for a class — admins own all
const ownedClass = async (req, classId) => {
  if (isAdmin(req)) return await get('SELECT id FROM classes WHERE id = ?', [classId]);
  return await get('SELECT id FROM classes WHERE id = ? AND teacher_id = ?', [classId, req.teacher.id]);
};

// Ownership check for a student (via class) — admins own all
const ownedStudent = async (req, studentId) => {
  if (isAdmin(req)) {
    return await get(`
      SELECT s.id, c.teacher_id FROM students s
      JOIN classes c ON s.class_id = c.id WHERE s.id = ?
    `, [studentId]);
  }
  return await get(`
    SELECT s.id, c.teacher_id FROM students s
    JOIN classes c ON s.class_id = c.id WHERE s.id = ? AND c.teacher_id = ?
  `, [studentId, req.teacher.id]);
};

/* ─────────────────────────────────────
   Student self-service (student JWT)
───────────────────────────────────── */
router.get('/me', studentAuthMiddleware, async (req, res) => {
  try {
    const student = await get(`
      SELECT s.*, c.name as class_name, c.subject
      FROM students s JOIN classes c ON s.class_id = c.id WHERE s.id = ?
    `, [req.student.studentRowId]);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const attendance = await all(`
      SELECT a.id, a.date, a.scanned_at, a.status, c.name as class_name
      FROM attendance a JOIN classes c ON a.class_id = c.id
      WHERE a.student_id = ? ORDER BY a.date DESC
    `, [req.student.studentRowId]);

    const classDates   = await all('SELECT DISTINCT date FROM attendance WHERE class_id = ?', [student.class_id]);
    const presentDates = new Set(attendance.filter(a => a.status === 'present').map(a => a.date));
    res.json({
      student, attendance,
      summary: {
        totalSessions: classDates.length,
        totalPresent:  presentDates.size,
        totalAbsent:   classDates.length - presentDates.size,
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/me/qr', studentAuthMiddleware, async (req, res) => {
  try {
    const student = await get('SELECT * FROM students WHERE id = ?', [req.student.studentRowId]);
    if (!student) return res.status(404).json({ error: 'Not found' });
    const qr = await QRCode.toDataURL(student.qr_token, {
      errorCorrectionLevel: 'H', width: 320, margin: 2,
      color: { dark: '#3e6f5c', light: '#ffffff' }
    });
    res.json({ qr, student_name: student.name, student_id: student.student_id, qr_token: student.qr_token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ─────────────────────────────────────
   Teacher routes (teacher JWT required)
───────────────────────────────────── */
router.use(authMiddleware);

// GET /api/students?class_id=X
router.get('/', async (req, res) => {
  try {
    const { class_id } = req.query;
    const admin = isAdmin(req);

    if (class_id) {
      const cls = await ownedClass(req, class_id);
      if (!cls) return res.status(403).json({ error: 'Access denied' });

      const students = await all(`
        SELECT s.id, s.name, s.student_id, s.email, s.phone, s.lrn,
               s.grade_level, s.section, s.student_code, s.photo, s.qr_token, s.created_at,
               (SELECT COUNT(*) FROM student_accounts sa WHERE sa.student_id = s.id) as has_account
        FROM students s WHERE s.class_id = ? ORDER BY s.name
      `, [class_id]);
      return res.json(students);
    }

    // All students — admins see all, teachers see own classes
    const students = admin
      ? await all(`
          SELECT s.id, s.name, s.student_id, s.email, s.phone, s.lrn,
                 s.grade_level, s.section, s.student_code, s.photo, s.qr_token, s.created_at,
                 c.name as class_name,
                 (SELECT COUNT(*) FROM student_accounts sa WHERE sa.student_id = s.id) as has_account
          FROM students s JOIN classes c ON s.class_id = c.id
          ORDER BY c.name, s.name
        `)
      : await all(`
          SELECT s.id, s.name, s.student_id, s.email, s.phone, s.lrn,
                 s.grade_level, s.section, s.student_code, s.photo, s.qr_token, s.created_at,
                 c.name as class_name,
                 (SELECT COUNT(*) FROM student_accounts sa WHERE sa.student_id = s.id) as has_account
          FROM students s JOIN classes c ON s.class_id = c.id
          WHERE c.teacher_id = ? ORDER BY c.name, s.name
        `, [req.teacher.id]);

    res.json(students);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/students
router.post('/', async (req, res) => {
  try {
    const { class_id, name, student_id, email } = req.body;
    if (!class_id || !name || !student_id)
      return res.status(400).json({ error: 'class_id, name, and student_id are required' });

    const cls = await ownedClass(req, class_id);
    if (!cls) return res.status(403).json({ error: 'Access denied' });

    if (await get('SELECT id FROM students WHERE student_id = ?', [student_id]))
      return res.status(409).json({ error: 'Student ID already exists' });

    const extra = {
      phone: req.body.phone || null, lrn: req.body.lrn || null,
      grade_level: req.body.grade_level || null, section: req.body.section || null,
      student_code: req.body.student_code || null,
    };
    const qr_token = uuidv4();
    const id = await insert(
      'INSERT INTO students (class_id, name, student_id, email, phone, lrn, grade_level, section, student_code, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [class_id, name, student_id, email || null, extra.phone, extra.lrn, extra.grade_level, extra.section, extra.student_code, qr_token]
    );
    res.status(201).json({ id, name, student_id, email, ...extra, qr_token, class_id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/students/bulk
router.post('/bulk', async (req, res) => {
  try {
    const { class_id, students } = req.body;
    if (!class_id || !Array.isArray(students) || !students.length)
      return res.status(400).json({ error: 'class_id and students array are required' });

    const cls = await ownedClass(req, class_id);
    if (!cls) return res.status(403).json({ error: 'Access denied' });

    const created = [];
    for (const s of students) {
      if (!s.name || !s.student_id) continue;
      if (await get('SELECT id FROM students WHERE student_id = ?', [s.student_id])) continue;
      const qr_token = uuidv4();
      try {
        const id = await insert(
          'INSERT INTO students (class_id, name, student_id, email, phone, lrn, grade_level, section, student_code, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [class_id, s.name, s.student_id, s.email || null, s.phone || null, s.lrn || null, s.grade_level || null, s.section || null, s.student_code || null, qr_token]
        );
        created.push({ id, name: s.name, student_id: s.student_id, qr_token });
      } catch {}
    }
    res.status(201).json({ created: created.length, students: created });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/students/:id/qr
router.get('/:id/qr', async (req, res) => {
  try {
    const student = await ownedStudent(req, req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found or access denied' });

    const full = await get('SELECT * FROM students WHERE id = ?', [req.params.id]);
    const qr = await QRCode.toDataURL(full.qr_token, {
      errorCorrectionLevel: 'H', width: 300, margin: 2,
      color: { dark: '#3e6f5c', light: '#ffffff' }
    });
    res.json({ qr, student_name: full.name, student_id: full.student_id, qr_token: full.qr_token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/students/:id
router.delete('/:id', async (req, res) => {
  try {
    const student = await ownedStudent(req, req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found or access denied' });

    await run('DELETE FROM student_accounts WHERE student_id = ?', [req.params.id]);
    await run('DELETE FROM attendance WHERE student_id = ?', [req.params.id]);
    await run('DELETE FROM students WHERE id = ?', [req.params.id]);
    res.json({ message: 'Student deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
