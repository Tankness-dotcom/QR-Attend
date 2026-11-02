const express = require('express');
const { all, get, insert, run } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/classes
router.get('/', (req, res) => {
  const classes = all(
    'SELECT * FROM classes WHERE teacher_id = ? ORDER BY created_at DESC',
    [req.teacher.id]
  );
  res.json(classes);
});

// POST /api/classes
router.post('/', (req, res) => {
  const { name, subject } = req.body;
  if (!name) return res.status(400).json({ error: 'Class name is required' });

  const id = insert(
    'INSERT INTO classes (teacher_id, name, subject) VALUES (?, ?, ?)',
    [req.teacher.id, name, subject || null]
  );
  res.status(201).json({ id, name, subject });
});

// PUT /api/classes/:id
router.put('/:id', (req, res) => {
  const cls = get('SELECT id FROM classes WHERE id = ? AND teacher_id = ?', [req.params.id, req.teacher.id]);
  if (!cls) return res.status(404).json({ error: 'Class not found' });

  const { name, subject } = req.body;
  run('UPDATE classes SET name = ?, subject = ? WHERE id = ?',
    [name || cls.name, subject ?? null, req.params.id]);
  res.json({ message: 'Updated' });
});

// DELETE /api/classes/:id
router.delete('/:id', (req, res) => {
  const cls = get('SELECT id FROM classes WHERE id = ? AND teacher_id = ?', [req.params.id, req.teacher.id]);
  if (!cls) return res.status(404).json({ error: 'Class not found' });

  const students = all('SELECT id FROM students WHERE class_id = ?', [req.params.id]);
  for (const s of students) {
    run('DELETE FROM student_accounts WHERE student_id = ?', [s.id]);
    run('DELETE FROM attendance WHERE student_id = ?', [s.id]);
  }
  run('DELETE FROM students WHERE class_id = ?', [req.params.id]);
  run('DELETE FROM classes WHERE id = ?', [req.params.id]);

  res.json({ message: 'Class deleted' });
});

module.exports = router;
