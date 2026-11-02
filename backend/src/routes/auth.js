const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { get, all, insert, run } = require('../database');
const { authMiddleware, adminMiddleware, studentAuthMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

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

router.post('/teacher/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const teacher = await get('SELECT * FROM teachers WHERE email = ?', [email]);
    if (!teacher || !bcrypt.compareSync(password, teacher.password))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { id: teacher.id, email: teacher.email, name: teacher.name, role: teacher.role, accountType: 'teacher' },
      JWT_SECRET, { expiresIn: '8h' }
    );
    res.json({ token, user: { id: teacher.id, name: teacher.name, email: teacher.email, role: teacher.role, photo: teacher.photo || null, accountType: 'teacher' } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/teacher/register', adminMiddleware, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
    const existing = await get('SELECT id FROM teachers WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const allowedRole = role === 'admin' ? 'admin' : 'teacher';
    const hash = bcrypt.hashSync(password, 10);
    const id   = await insert('INSERT INTO teachers (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hash, allowedRole]);
    res.status(201).json({ id, name, email, role: allowedRole });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/teacher/me', authMiddleware, async (req, res) => {
  try {
    const teacher = await get('SELECT id, name, email, role, photo FROM teachers WHERE id = ?', [req.teacher.id]);
    if (!teacher) return res.status(404).json({ error: 'Not found' });
    res.json({ user: { ...teacher, accountType: 'teacher' } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/teacher/photo', authMiddleware, async (req, res) => {
  try {
    const validated = validatePhoto(req.body.photo);
    await run('UPDATE teachers SET photo = ? WHERE id = ?', [validated, req.teacher.id]);
    res.json({ photo: validated });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/teacher/photo', authMiddleware, async (req, res) => {
  try {
    await run('UPDATE teachers SET photo = NULL WHERE id = ?', [req.teacher.id]);
    res.json({ message: 'Photo removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/teacher/password', authMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'current_password and new_password are required' });
    if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const teacher = await get('SELECT password FROM teachers WHERE id = ?', [req.teacher.id]);
    if (!bcrypt.compareSync(current_password, teacher.password)) return res.status(401).json({ error: 'Current password is incorrect' });
    await run('UPDATE teachers SET password = ? WHERE id = ?', [bcrypt.hashSync(new_password, 10), req.teacher.id]);
    res.json({ message: 'Password updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/teachers', adminMiddleware, async (req, res) => {
  try {
    const teachers = await all('SELECT id, name, email, role, photo, created_at FROM teachers ORDER BY created_at DESC');
    res.json(teachers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/teachers/:id', adminMiddleware, async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.teacher.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    await run('DELETE FROM teachers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Teacher account deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ════════════════════════════════════
   STUDENT AUTH
═══════════════════════════════════════ */

router.post('/student/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    const account = await get(`
      SELECT sa.*, s.name, s.student_id as student_number, s.email, s.qr_token,
             s.class_id, s.id as student_row_id, s.photo
      FROM student_accounts sa
      JOIN students s ON sa.student_id = s.id
      WHERE sa.username = ?
    `, [username]);
    if (!account || !bcrypt.compareSync(password, account.password))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { id: account.id, studentRowId: account.student_row_id, username: account.username, name: account.name, studentNumber: account.student_number, classId: account.class_id, qrToken: account.qr_token, accountType: 'student' },
      JWT_SECRET, { expiresIn: '8h' }
    );
    res.json({ token, user: { id: account.id, studentRowId: account.student_row_id, username: account.username, name: account.name, studentNumber: account.student_number, classId: account.class_id, qrToken: account.qr_token, photo: account.photo || null, accountType: 'student' } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/student/create', authMiddleware, async (req, res) => {
  try {
    const { student_id, username, password } = req.body;
    if (!student_id || !username || !password) return res.status(400).json({ error: 'student_id, username and password are required' });
    const student = await get(`SELECT s.* FROM students s JOIN classes c ON s.class_id = c.id WHERE s.id = ? AND c.teacher_id = ?`, [student_id, req.teacher.id]);
    if (!student) return res.status(403).json({ error: 'Access denied or student not found' });
    if (await get('SELECT id FROM student_accounts WHERE username = ?', [username])) return res.status(409).json({ error: 'Username already taken' });
    if (await get('SELECT id FROM student_accounts WHERE student_id = ?', [student_id])) return res.status(409).json({ error: 'Student already has an account' });
    const hash = bcrypt.hashSync(password, 10);
    const id   = await insert('INSERT INTO student_accounts (student_id, username, password) VALUES (?, ?, ?)', [student_id, username, hash]);
    res.status(201).json({ id, username, student_id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/student/self-register', async (req, res) => {
  try {
    const { student_id, username, password } = req.body;
    if (!student_id || !username || !password) return res.status(400).json({ error: 'Student ID, username and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
    if (!/^[a-zA-Z0-9._-]+$/.test(username)) return res.status(400).json({ error: 'Username may only contain letters, numbers, dots, hyphens and underscores' });
    const student = await get('SELECT * FROM students WHERE student_id = ?', [student_id.trim()]);
    if (!student) return res.status(404).json({ error: 'No enrolled student found with that Student ID. Please check your ID or contact your teacher.' });
    if (await get('SELECT id FROM student_accounts WHERE student_id = ?', [student.id])) return res.status(409).json({ error: 'An account already exists for this student. Please log in instead.' });
    if (await get('SELECT id FROM student_accounts WHERE username = ?', [username])) return res.status(409).json({ error: 'That username is already taken. Please choose another.' });
    const hash = bcrypt.hashSync(password, 10);
    await insert('INSERT INTO student_accounts (student_id, username, password) VALUES (?, ?, ?)', [student.id, username, hash]);
    res.status(201).json({ message: `Account created successfully! You can now log in as "${username}".`, student_name: student.name, username });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/student/lookup-id', async (req, res) => {
  try {
    const { student_id } = req.query;
    if (!student_id) return res.status(400).json({ error: 'Student ID is required' });
    const student = await get(`
      SELECT s.name, s.student_id, s.grade_level, s.section, s.student_code,
             c.name as class_name,
             (SELECT COUNT(*) FROM student_accounts sa WHERE sa.student_id = s.id) as has_account
      FROM students s JOIN classes c ON s.class_id = c.id WHERE s.student_id = ?
    `, [student_id.trim()]);
    if (!student) return res.status(404).json({ error: 'No student found with that Student ID.' });
    res.json({ name: student.name, student_id: student.student_id, grade_level: student.grade_level, section: student.section, student_code: student.student_code, class_name: student.class_name, has_account: !!student.has_account });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/student/me', studentAuthMiddleware, async (req, res) => {
  try {
    const student = await get('SELECT photo FROM students WHERE id = ?', [req.student.studentRowId]);
    res.json({ user: { ...req.student, photo: student?.photo || null, accountType: 'student' } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/student/photo', studentAuthMiddleware, async (req, res) => {
  try {
    const validated = validatePhoto(req.body.photo);
    await run('UPDATE students SET photo = ? WHERE id = ?', [validated, req.student.studentRowId]);
    res.json({ photo: validated });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/student/photo', studentAuthMiddleware, async (req, res) => {
  try {
    await run('UPDATE students SET photo = NULL WHERE id = ?', [req.student.studentRowId]);
    res.json({ message: 'Photo removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/student/password', studentAuthMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'current_password and new_password are required' });
    if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const account = await get('SELECT password FROM student_accounts WHERE id = ?', [req.student.id]);
    if (!bcrypt.compareSync(current_password, account.password)) return res.status(401).json({ error: 'Current password is incorrect' });
    await run('UPDATE student_accounts SET password = ? WHERE id = ?', [bcrypt.hashSync(new_password, 10), req.student.id]);
    res.json({ message: 'Password updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
