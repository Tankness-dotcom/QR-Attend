const express = require('express');
const { all, get, insert, run } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/* helper */
const isAdmin = (req) => req.teacher?.role === 'admin';

// Returns today's date string (YYYY-MM-DD) in Philippine Time
function todayPHT() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

// Ownership check for a class — admins can access any class
const ownedClass = async (req, classId) => {
  if (isAdmin(req)) return await get('SELECT id, name FROM classes WHERE id = ?', [classId]);
  return await get('SELECT id, name FROM classes WHERE id = ? AND teacher_id = ?', [classId, req.teacher.id]);
};

/* ── Public scan endpoint ── */
router.post('/scan', async (req, res) => {
  try {
    const { qr_token, class_id } = req.body;
    if (!qr_token || !class_id)
      return res.status(400).json({ error: 'qr_token and class_id are required' });

    const student = await get('SELECT * FROM students WHERE qr_token = ?', [qr_token]);
    if (!student) return res.status(404).json({ error: 'Invalid QR code' });
    if (String(student.class_id) !== String(class_id))
      return res.status(400).json({ error: 'Student is not enrolled in this class' });

    const today = todayPHT();
    const existing = await get(
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

    // Store scanned_at in Philippine Time (UTC+8)
    await insert(
      "INSERT INTO attendance (student_id, class_id, date, scanned_at) VALUES (?, ?, ?, datetime('now', '+8 hours'))",
      [student.id, class_id, today]
    );
    const newRec = await get(
      'SELECT scanned_at FROM attendance WHERE student_id = ? AND class_id = ? AND date = ?',
      [student.id, class_id, today]
    );
    res.status(201).json({
      success: true, alreadyMarked: false,
      message: `✅ ${student.name} marked present`,
      student: { name: student.name, student_id: student.student_id },
      scanned_at: newRec?.scanned_at
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── Teacher-protected routes ── */
router.use(authMiddleware);

// GET /api/attendance
router.get('/', async (req, res) => {
  try {
    const { class_id, date, student_id } = req.query;
    const admin = isAdmin(req);

    let sql = `
      SELECT a.id, a.date, a.scanned_at, a.status,
             s.name as student_name, s.student_id as student_number, c.name as class_name
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN classes  c ON a.class_id   = c.id
      WHERE ${admin ? '1=1' : 'c.teacher_id = ?'}
    `;
    const params = admin ? [] : [req.teacher.id];

    if (class_id)   { sql += ' AND a.class_id = ?';   params.push(class_id); }
    if (date)       { sql += ' AND a.date = ?';        params.push(date); }
    if (student_id) { sql += ' AND s.student_id = ?';  params.push(student_id); }
    sql += ' ORDER BY a.scanned_at DESC';

    res.json(await all(sql, params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/attendance/summary?class_id=X
router.get('/summary', async (req, res) => {
  try {
    const { class_id } = req.query;
    if (!class_id) return res.status(400).json({ error: 'class_id is required' });

    const cls = await ownedClass(req, class_id);
    if (!cls) return res.status(403).json({ error: 'Access denied' });

    const totalDaysRow = await get(
      'SELECT COUNT(DISTINCT date) as cnt FROM attendance WHERE class_id = ?', [class_id]
    );
    const totalDays = totalDaysRow?.cnt || 0;
    const students  = await all('SELECT id, name, student_id FROM students WHERE class_id = ?', [class_id]);

    const summary = await Promise.all(students.map(async s => {
      const presentRow = await get(
        "SELECT COUNT(*) as cnt FROM attendance WHERE student_id = ? AND class_id = ? AND status = 'present'",
        [s.id, class_id]
      );
      const lateRow = await get(
        "SELECT COUNT(*) as cnt FROM attendance WHERE student_id = ? AND class_id = ? AND status = 'late'",
        [s.id, class_id]
      );
      const daysPresent = (presentRow?.cnt || 0) + (lateRow?.cnt || 0);
      const daysLate    = lateRow?.cnt || 0;
      const absences    = totalDays - daysPresent;
      const percentage  = totalDays > 0 ? Math.round((daysPresent / totalDays) * 1000) / 10 : 0;
      return { ...s, days_present: daysPresent, days_late: daysLate, absences, total_days: totalDays, percentage };
    }));

    res.json(summary);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/attendance/today?class_id=X
router.get('/today', async (req, res) => {
  try {
    const { class_id } = req.query;
    if (!class_id) return res.status(400).json({ error: 'class_id is required' });

    const cls = await ownedClass(req, class_id);
    if (!cls) return res.status(403).json({ error: 'Access denied' });

    const today    = todayPHT();
    const students = await all(
      'SELECT id, name, student_id FROM students WHERE class_id = ? ORDER BY name', [class_id]
    );
    const todayRec = await all(
      'SELECT student_id as sid, status, scanned_at FROM attendance WHERE class_id = ? AND date = ?',
      [class_id, today]
    );
    const recMap = Object.fromEntries(todayRec.map(r => [r.sid, r]));

    const result = students.map(s => {
      const rec = recMap[s.id];
      return {
        id: s.id, name: s.name, student_id: s.student_id,
        status:     rec ? rec.status    : 'absent',
        scanned_at: rec ? rec.scanned_at : null,
        present:    !!rec,
      };
    });

    res.json({
      date: today, class_name: cls.name, total: students.length,
      present: result.filter(r => r.status === 'present').length,
      late:    result.filter(r => r.status === 'late').length,
      absent:  result.filter(r => !r.present).length,
      students: result
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/attendance/dates?class_id=X
router.get('/dates', async (req, res) => {
  try {
    const { class_id } = req.query;
    if (!class_id) return res.status(400).json({ error: 'class_id is required' });

    const cls = await ownedClass(req, class_id);
    if (!cls) return res.status(403).json({ error: 'Access denied' });

    const dates = await all(
      'SELECT DISTINCT date FROM attendance WHERE class_id = ? ORDER BY date DESC', [class_id]
    );
    res.json(dates.map(r => r.date));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/attendance/manual
router.post('/manual', async (req, res) => {
  try {
    const { student_id, class_id, date, status } = req.body;
    if (!student_id || !class_id || !date)
      return res.status(400).json({ error: 'student_id, class_id and date are required' });

    const cls = await ownedClass(req, class_id);
    if (!cls) return res.status(403).json({ error: 'Access denied' });

    const student = await get('SELECT id FROM students WHERE id = ? AND class_id = ?', [student_id, class_id]);
    if (!student) return res.status(404).json({ error: 'Student not found in class' });

    const existing = await get(
      'SELECT id FROM attendance WHERE student_id = ? AND class_id = ? AND date = ?',
      [student_id, class_id, date]
    );
    const finalStatus = status || 'present';
    if (existing) {
      await run('UPDATE attendance SET status = ? WHERE id = ?', [finalStatus, existing.id]);
    } else {
      // Store scanned_at in Philippine Time (UTC+8)
      await insert(
        "INSERT INTO attendance (student_id, class_id, date, status, scanned_at) VALUES (?, ?, ?, ?, datetime('now', '+8 hours'))",
        [student_id, class_id, date, finalStatus]
      );
    }
    res.json({ message: `Attendance marked as ${finalStatus}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/attendance/:id
router.delete('/:id', async (req, res) => {
  try {
    const admin = isAdmin(req);
    const record = admin
      ? await get('SELECT a.id FROM attendance a WHERE a.id = ?', [req.params.id])
      : await get(
          'SELECT a.id FROM attendance a JOIN classes c ON a.class_id = c.id WHERE a.id = ? AND c.teacher_id = ?',
          [req.params.id, req.teacher.id]
        );

    if (!record) return res.status(404).json({ error: 'Record not found' });
    await run('DELETE FROM attendance WHERE id = ?', [req.params.id]);
    res.json({ message: 'Record deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
