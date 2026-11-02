const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { get, all, insert, run } = require('../database');
const { authMiddleware, adminMiddleware, studentAuthMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

/* ── helpers ── */
// Resize / validate incoming base64 image — reject if too large (>2MB raw)
function validatePhoto(dataUrl) {
  if (!dataUrl) return null;
  if (!dataUrl.startsWith('data:image/')) throw new Error('Invalid image format');
  const base64 = dataUrl.split(',')[1] || '';
  if (base64.length > 2_800_000) throw new Error('Image too large (max ~2 MB)');
  return dataUrl;
}

/* ════════════════════════════════════
   TEACHER AUTH
═══════════════════════════════════════ */

// POST /api/auth/teacher/login
router.post('/teacher/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const teacher = get('SELECT * FROM teachers WHERE email = ?', [email]);
  if (!teacher || !bcrypt.compareSync(password, teacher.password))
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: teacher.id, email: teacher.email, name: teacher.name, role: teacher.role, accountType: 'teacher' },
    JWT_SECRET, { expiresIn: '8h' }
  );
  res.json({
    token,
    user: { id: teacher.id, name: teacher.name, email: teacher.email, role: teacher.role, photo: teacher.photo || null, accountType: 'teacher' }
  });
});

// POST /api/auth/teacher/register  — admin only
router.post('/teacher/register', adminMiddleware, (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email and password are required' });

  const existing = get('SELECT id FROM teachers WHERE email = ?', [email]);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const allowedRole = role === 'admin' ? 'admin' : 'teacher';
  const hash = bcrypt.hashSync(password, 10);
  const id   = insert(
    'INSERT INTO teachers (name, email, password, role) VALUES (?, ?, ?, ?)',
    [name, email, hash, allowedRole]
  );
  res.status(201).json({ id, name, email, role: allowedRole });
});

// GET /api/auth/teacher/me
router.get('/teacher/me', authMiddleware, (req, res) => {
  const teacher = get('SELECT id, name, email, role, photo FROM teachers WHERE id = ?', [req.teacher.id]);
  if (!teacher) return res.status(404).json({ error: 'Not found' });
  res.json({ user: { ...teacher, accountType: 'teacher' } });
});

// PUT /api/auth/teacher/photo  — upload/update own photo
router.put('/teacher/photo', authMiddleware, (req, res) => {
  const { photo } = req.body;
  try {
    const validated = validatePhoto(photo);
    run('UPDATE teachers SET photo = ? WHERE id = ?', [validated, req.teacher.id]);
    res.json({ photo: validated });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/auth/teacher/photo  — remove own photo
router.delete('/teacher/photo', authMiddleware, (req, res) => {
  run('UPDATE teachers SET photo = NULL WHERE id = ?', [req.teacher.id]);
  res.json({ message: 'Photo removed' });
});

// PUT /api/auth/teacher/password — change own password
router.put('/teacher/password', authMiddleware, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'current_password and new_password are required' });
  if (new_password.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const teacher = get('SELECT password FROM teachers WHERE id = ?', [req.teacher.id]);
  if (!bcrypt.compareSync(current_password, teacher.password))
    return res.status(401).json({ error: 'Current password is incorrect' });

  run('UPDATE teachers SET password = ? WHERE id = ?', [bcrypt.hashSync(new_password, 10), req.teacher.id]);
  res.json({ message: 'Password updated' });
});

// GET /api/auth/teachers  — list all teachers (admin only)
router.get('/teachers', adminMiddleware, (req, res) => {
  const teachers = all('SELECT id, name, email, role, photo, created_at FROM teachers ORDER BY created_at DESC');
  res.json(teachers);
});

// DELETE /api/auth/teachers/:id  — admin only
router.delete('/teachers/:id', adminMiddleware, (req, res) => {
  if (parseInt(req.params.id) === req.teacher.id)
    return res.status(400).json({ error: 'Cannot delete your own account' });
  run('DELETE FROM teachers WHERE id = ?', [req.params.id]);
  res.json({ message: 'Teacher account deleted' });
});

/* ════════════════════════════════════
   STUDENT AUTH
═══════════════════════════════════════ */

// POST /api/auth/student/login
router.post('/student/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required' });

  const account = get(`
    SELECT sa.*, s.name, s.student_id as student_number, s.email, s.qr_token,
           s.class_id, s.id as student_row_id, s.photo
    FROM student_accounts sa
    JOIN students s ON sa.student_id = s.id
    WHERE sa.username = ?
  `, [username]);

  if (!account || !bcrypt.compareSync(password, account.password))
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    {
      id: account.id, studentRowId: account.student_row_id,
      username: account.username, name: account.name,
      studentNumber: account.student_number, classId: account.class_id,
      qrToken: account.qr_token, accountType: 'student'
    },
    JWT_SECRET, { expiresIn: '8h' }
  );

  res.json({
    token,
    user: {
      id: account.id, studentRowId: account.student_row_id,
      username: account.username, name: account.name,
      studentNumber: account.student_number, classId: account.class_id,
      qrToken: account.qr_token, photo: account.photo || null,
      accountType: 'student'
    }
  });
});

// POST /api/auth/student/create  — teacher creates a student account
router.post('/student/create', authMiddleware, (req, res) => {
  const { student_id, username, password } = req.body;
  if (!student_id || !username || !password)
    return res.status(400).json({ error: 'student_id, username and password are required' });

  const student = get(`
    SELECT s.* FROM students s
    JOIN classes c ON s.class_id = c.id
    WHERE s.id = ? AND c.teacher_id = ?
  `, [student_id, req.teacher.id]);
  if (!student) return res.status(403).json({ error: 'Access denied or student not found' });

  if (get('SELECT id FROM student_accounts WHERE username = ?', [username]))
    return res.status(409).json({ error: 'Username already taken' });
  if (get('SELECT id FROM student_accounts WHERE student_id = ?', [student_id]))
    return res.status(409).json({ error: 'Student already has an account' });

  const hash = bcrypt.hashSync(password, 10);
  const id   = insert('INSERT INTO student_accounts (student_id, username, password) VALUES (?, ?, ?)',
    [student_id, username, hash]);
  res.status(201).json({ id, username, student_id });
});

// GET /api/auth/student/me
router.get('/student/me', studentAuthMiddleware, (req, res) => {
  const student = get('SELECT photo FROM students WHERE id = ?', [req.student.studentRowId]);
  res.json({ user: { ...req.student, photo: student?.photo || null, accountType: 'student' } });
});

// PUT /api/auth/student/photo  — student uploads own photo
router.put('/student/photo', studentAuthMiddleware, (req, res) => {
  const { photo } = req.body;
  try {
    const validated = validatePhoto(photo);
    run('UPDATE students SET photo = ? WHERE id = ?', [validated, req.student.studentRowId]);
    res.json({ photo: validated });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/auth/student/photo  — student removes own photo
router.delete('/student/photo', studentAuthMiddleware, (req, res) => {
  run('UPDATE students SET photo = NULL WHERE id = ?', [req.student.studentRowId]);
  res.json({ message: 'Photo removed' });
});

// PUT /api/auth/student/password — student changes own password
router.put('/student/password', studentAuthMiddleware, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'current_password and new_password are required' });
  if (new_password.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const account = get('SELECT password FROM student_accounts WHERE id = ?', [req.student.id]);
  if (!bcrypt.compareSync(current_password, account.password))
    return res.status(401).json({ error: 'Current password is incorrect' });

  run('UPDATE student_accounts SET password = ? WHERE id = ?', [bcrypt.hashSync(new_password, 10), req.student.id]);
  res.json({ message: 'Password updated' });
});

module.exports = router;
