const express = require('express');
const { all, get, insert, run } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

/* helper — admins own all classes */
const classFilter = (req) => req.teacher.role === 'admin'
  ? 'SELECT id FROM classes WHERE id = ?'          // admin: no teacher check
  : 'SELECT id FROM classes WHERE id = ? AND teacher_id = ?'; // teacher: own only

const classParams = (req, id) => req.teacher.role === 'admin'
  ? [id]
  : [id, req.teacher.id];

// GET /api/classes
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.teacher.role === 'admin';
    const classes = isAdmin
      ? await all('SELECT * FROM classes ORDER BY created_at DESC')
      : await all('SELECT * FROM classes WHERE teacher_id = ? ORDER BY created_at DESC', [req.teacher.id]);
    res.json(classes);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/classes — always created under the requesting teacher
router.post('/', async (req, res) => {
  try {
    const { name, subject } = req.body;
    if (!name) return res.status(400).json({ error: 'Class name is required' });
    const id = await insert(
      'INSERT INTO classes (teacher_id, name, subject) VALUES (?, ?, ?)',
      [req.teacher.id, name, subject || null]
    );
    res.status(201).json({ id, name, subject });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/classes/:id
router.put('/:id', async (req, res) => {
  try {
    const cls = await get(classFilter(req), classParams(req, req.params.id));
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    const { name, subject } = req.body;
    await run('UPDATE classes SET name = ?, subject = ? WHERE id = ?',
      [name || cls.name, subject ?? null, req.params.id]);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/classes/:id
router.delete('/:id', async (req, res) => {
  try {
    const cls = await get(classFilter(req), classParams(req, req.params.id));
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    const students = await all('SELECT id FROM students WHERE class_id = ?', [req.params.id]);
    for (const s of students) {
      await run('DELETE FROM student_accounts WHERE student_id = ?', [s.id]);
      await run('DELETE FROM attendance WHERE student_id = ?', [s.id]);
    }
    await run('DELETE FROM students WHERE class_id = ?', [req.params.id]);
    await run('DELETE FROM classes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Class deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
