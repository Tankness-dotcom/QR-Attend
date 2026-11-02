const express = require('express');
const { all, get, insert, run } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const classes = await all('SELECT * FROM classes WHERE teacher_id = ? ORDER BY created_at DESC', [req.teacher.id]);
    res.json(classes);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, subject } = req.body;
    if (!name) return res.status(400).json({ error: 'Class name is required' });
    const id = await insert('INSERT INTO classes (teacher_id, name, subject) VALUES (?, ?, ?)', [req.teacher.id, name, subject || null]);
    res.status(201).json({ id, name, subject });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const cls = await get('SELECT id, name FROM classes WHERE id = ? AND teacher_id = ?', [req.params.id, req.teacher.id]);
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    const { name, subject } = req.body;
    await run('UPDATE classes SET name = ?, subject = ? WHERE id = ?', [name || cls.name, subject ?? null, req.params.id]);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const cls = await get('SELECT id FROM classes WHERE id = ? AND teacher_id = ?', [req.params.id, req.teacher.id]);
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
