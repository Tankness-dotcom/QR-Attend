const express = require('express');
const { all, get, insert, run } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/* ── Public scan endpoint ── */
router.post('/scan', (req, res) => {
  const { qr_token, class_id } = req.body;
  if (!qr_token || !class_id)
    return res.status(400).json({ error: 'qr_token and class_id are required' });

  const student = get('SELECT * FROM students WHERE qr_token = ?', [qr_token]);
  if (!student) return res.status(404).json({ error: 'Invalid QR code' });

  if (String(student.class_id) !== String(class_id))
    return res.status(400).json({ error: 'Student is not enrolled in this class' });

  const today = new Date().toISOString().split('T')[0];
  const existing = get(
    'SELECT id, scanned_at FROM attendance WHERE student_id = ? AND class_id = ? AND date = ?',
    [student.id, class_id, today]
  );

  if (existing) {
    return res.json({
      success: true, alreadyMarked: true,
      message: `${student.name} already marked present today`,
      student: { name: student.name, student_id: student.student_id },
      scanned_at: existing.scanned_at
    });
  }

  insert('INSERT INTO attendance (student_id, class_id, date) VALUES (?, ?, ?)',
    [student.id, class_id, today]);

  const newRec = get(
    'SELECT scanned_at FROM attendance WHERE student_id = ? AND class_id = ? AND date = ?',
    [student.id, class_id, today]
  );

  res.status(201).json({
    success: true, alreadyMarked: false,
    message: `✅ ${student.name} marked present`,
    student: { name: student.name, student_id: student.student_id },
    scanned_at: newRec?.scanned_at
  });
});

/* ── Teacher-protected routes ── */
router.use(authMiddleware);

// GET /api/attendance
router.get('/', (req, res) => {
  const { class_id, date, student_id } = req.query;
  let sql = `
    SELECT a.id, a.date, a.scanned_at, a.status,
           s.name as student_name, s.student_id as student_number,
           c.name as class_name
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    JOIN classes  c ON a.class_id   = c.id
    WHERE c.teacher_id = ?
  `;
  const params = [req.teacher.id];
  if (class_id)   { sql += ' AND a.class_id = ?';    params.push(class_id); }
  if (date)       { sql += ' AND a.date = ?';         params.push(date); }
  if (student_id) { sql += ' AND s.student_id = ?';   params.push(student_id); }
  sql += ' ORDER BY a.scanned_at DESC';
  res.json(all(sql, params));
});

// GET /api/attendance/summary?class_id=X
router.get('/summary', (req, res) => {
  const { class_id } = req.query;
  if (!class_id) return res.status(400).json({ error: 'class_id is required' });

  const cls = get('SELECT id FROM classes WHERE id = ? AND teacher_id = ?', [class_id, req.teacher.id]);
  if (!cls) return res.status(403).json({ error: 'Access denied' });

  const totalDaysRow = get(
    'SELECT COUNT(DISTINCT date) as cnt FROM attendance WHERE class_id = ?', [class_id]
  );
  const totalDays = totalDaysRow?.cnt || 0;

  const students = all('SELECT id, name, student_id FROM students WHERE class_id = ?', [class_id]);

  const summary = students.map(s => {
    const presentRow = get(
      'SELECT COUNT(*) as cnt FROM attendance WHERE student_id = ? AND class_id = ? AND status = ?',
      [s.id, class_id, 'present']
    );
    const lateRow = get(
      'SELECT COUNT(*) as cnt FROM attendance WHERE student_id = ? AND class_id = ? AND status = ?',
      [s.id, class_id, 'late']
    );
    const daysPresent = (presentRow?.cnt || 0) + (lateRow?.cnt || 0); // present + late counts as attended
    const daysLate    = lateRow?.cnt || 0;
    const absences    = totalDays - daysPresent;
    const percentage  = totalDays > 0 ? Math.round((daysPresent / totalDays) * 1000) / 10 : 0;
    return { ...s, days_present: daysPresent, days_late: daysLate, absences, total_days: totalDays, percentage };
  });

  res.json(summary);
});

// GET /api/attendance/today?class_id=X — today's scan log with times
router.get('/today', (req, res) => {
  const { class_id } = req.query;
  if (!class_id) return res.status(400).json({ error: 'class_id is required' });

  const cls = get('SELECT id, name FROM classes WHERE id = ? AND teacher_id = ?', [class_id, req.teacher.id]);
  if (!cls) return res.status(403).json({ error: 'Access denied' });

  const today = new Date().toISOString().split('T')[0];

  // All students in the class
  const students = all(
    'SELECT id, name, student_id FROM students WHERE class_id = ? ORDER BY name',
    [class_id]
  );

  // Today's attendance records
  const todayRecords = all(`
    SELECT a.student_id as sid, a.status, a.scanned_at
    FROM attendance a
    WHERE a.class_id = ? AND a.date = ?
  `, [class_id, today]);

  const recordMap = Object.fromEntries(todayRecords.map(r => [r.sid, r]));

  const result = students.map(s => {
    const rec = recordMap[s.id];
    return {
      id:         s.id,
      name:       s.name,
      student_id: s.student_id,
      status:     rec ? rec.status : 'absent',
      scanned_at: rec ? rec.scanned_at : null,
      present:    !!rec,
    };
  });

  const presentCount = result.filter(r => r.status === 'present').length;
  const lateCount    = result.filter(r => r.status === 'late').length;
  const absentCount  = result.filter(r => !r.present).length;

  res.json({
    date: today,
    class_name: cls.name,
    total: students.length,
    present: presentCount,
    late: lateCount,
    absent: absentCount,
    students: result
  });
});

// GET /api/attendance/dates?class_id=X
router.get('/dates', (req, res) => {
  const { class_id } = req.query;
  if (!class_id) return res.status(400).json({ error: 'class_id is required' });

  const cls = get('SELECT id FROM classes WHERE id = ? AND teacher_id = ?', [class_id, req.teacher.id]);
  if (!cls) return res.status(403).json({ error: 'Access denied' });

  const dates = all('SELECT DISTINCT date FROM attendance WHERE class_id = ? ORDER BY date DESC', [class_id]);
  res.json(dates.map(r => r.date));
});

// POST /api/attendance/manual — teacher manually marks a student present/absent
router.post('/manual', (req, res) => {
  const { student_id, class_id, date, status } = req.body;
  if (!student_id || !class_id || !date)
    return res.status(400).json({ error: 'student_id, class_id and date are required' });

  const cls = get('SELECT id FROM classes WHERE id = ? AND teacher_id = ?', [class_id, req.teacher.id]);
  if (!cls) return res.status(403).json({ error: 'Access denied' });

  const student = get('SELECT id FROM students WHERE id = ? AND class_id = ?', [student_id, class_id]);
  if (!student) return res.status(404).json({ error: 'Student not found in class' });

  const existing = get(
    'SELECT id FROM attendance WHERE student_id = ? AND class_id = ? AND date = ?',
    [student_id, class_id, date]
  );

  const finalStatus = status || 'present';

  if (existing) {
    run('UPDATE attendance SET status = ? WHERE id = ?', [finalStatus, existing.id]);
  } else {
    insert('INSERT INTO attendance (student_id, class_id, date, status) VALUES (?, ?, ?, ?)',
      [student_id, class_id, date, finalStatus]);
  }

  res.json({ message: `Attendance marked as ${finalStatus}` });
});

// DELETE /api/attendance/:id
router.delete('/:id', (req, res) => {
  const record = get(`
    SELECT a.id FROM attendance a
    JOIN classes c ON a.class_id = c.id
    WHERE a.id = ? AND c.teacher_id = ?
  `, [req.params.id, req.teacher.id]);

  if (!record) return res.status(404).json({ error: 'Record not found' });

  run('DELETE FROM attendance WHERE id = ?', [req.params.id]);
  res.json({ message: 'Record deleted' });
});

module.exports = router;
