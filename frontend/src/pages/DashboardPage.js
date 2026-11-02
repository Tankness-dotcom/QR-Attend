import React, { useState, useEffect, useCallback } from 'react';
import {
  getClasses, createClass, deleteClass,
  getAttendanceSummary, getAttendance, getAttendanceDates,
  getAttendanceToday, deleteAttendance, markAttendanceManual
} from '../api';

/* ── Thresholds ── */
const WARN_THRESHOLD     = 2;
const CRITICAL_THRESHOLD = 3;

/* ── Live clock hook ── */
function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/* ── Helpers ── */
function fmtTime(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
}

function StatusBadge({ status }) {
  const map = {
    present: { cls: 'badge-green',  label: '✓ Present' },
    late:    { cls: 'badge-yellow', label: '🕐 Late'   },
    absent:  { cls: 'badge-red',    label: '✗ Absent'  },
  };
  const cfg = map[status] || map.absent;
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
}

function AbsenceWarningBadge({ absences }) {
  if (absences < WARN_THRESHOLD) return null;
  const isCritical = absences >= CRITICAL_THRESHOLD;
  return (
    <span className="badge" style={{ background: isCritical ? '#fee2e2' : '#ffedd5', color: isCritical ? '#991b1b' : '#9a3412', marginLeft: '.4rem' }}
      title={isCritical ? 'Critical: 3+ absences' : 'Warning: 2 absences'}>
      {isCritical ? '🚨' : '⚠️'} {absences} abs
    </span>
  );
}

function AbsenceWarningRows({ summary }) {
  const warned = summary.filter(s => s.absences >= WARN_THRESHOLD);
  if (!warned.length) return null;
  return (
    <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
      {warned.map(s => {
        const isCritical = s.absences >= CRITICAL_THRESHOLD;
        return (
          <div key={s.id} className={`absence-warning ${isCritical ? 'critical' : ''}`}>
            <div className="aw-icon">{isCritical ? '🚨' : '⚠️'}</div>
            <div>
              <div className="aw-title" style={{ color: isCritical ? '#991b1b' : '#9a3412' }}>
                {isCritical ? 'Critical Attendance Alert — ' : 'Absence Warning — '}
                <strong>{s.name}</strong>
                <span className="badge badge-blue" style={{ marginLeft: '.4rem', fontSize: '.7rem' }}>{s.student_id}</span>
              </div>
              <div className="aw-body">
                {s.absences} absence{s.absences !== 1 ? 's' : ''} out of {s.total_days} session{s.total_days !== 1 ? 's' : ''} — attendance rate: <strong>{s.percentage}%</strong>.
                {s.days_late > 0 && <span style={{ marginLeft: '.4rem' }}>🕐 {s.days_late} late.</span>}
                {isCritical ? ' Immediate follow-up recommended.' : ' Consider reaching out to this student.'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════ */
export default function DashboardPage() {
  const now = useLiveClock();

  const [classes, setClasses]        = useState([]);
  const [selectedClass, setSelected] = useState('');
  const [view, setView]              = useState('today'); // 'today' | 'summary' | 'records'
  const [summary, setSummary]        = useState([]);
  const [todayData, setTodayData]    = useState(null);
  const [records, setRecords]        = useState([]);
  const [dates, setDates]            = useState([]);
  const [filterDate, setFilterDate]  = useState('');
  const [loading, setLoading]        = useState(false);

  const [showNewClass, setShowNewClass]   = useState(false);
  const [newClassName, setNewClassName]   = useState('');
  const [newClassSubject, setNewClassSub] = useState('');
  const [classError, setClassError]       = useState('');

  const [showManual, setShowManual]     = useState(null);
  const [manualDate, setManualDate]     = useState('');
  const [manualStatus, setManualStatus] = useState('present');
  const [manualMsg, setManualMsg]       = useState('');

  /* ── load classes ── */
  const loadClasses = useCallback(async () => {
    try {
      const data = await getClasses();
      setClasses(data);
      if (!selectedClass && data.length > 0) setSelected(String(data[0].id));
    } catch {}
  }, [selectedClass]);

  useEffect(() => { loadClasses(); }, []); // eslint-disable-line

  /* ── load class data when class changes ── */
  const loadClassData = useCallback(async (classId) => {
    if (!classId) return;
    setLoading(true);
    try {
      const [s, d, t] = await Promise.all([
        getAttendanceSummary(classId),
        getAttendanceDates(classId),
        getAttendanceToday(classId),
      ]);
      setSummary(s);
      setDates(d);
      setTodayData(t);
      setFilterDate('');
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadClassData(selectedClass); }, [selectedClass, loadClassData]);

  /* ── load records when switching to records view ── */
  useEffect(() => {
    if (!selectedClass || view !== 'records') return;
    setLoading(true);
    const params = { class_id: selectedClass };
    if (filterDate) params.date = filterDate;
    getAttendance(params).then(setRecords).catch(() => {}).finally(() => setLoading(false));
  }, [selectedClass, view, filterDate]);

  /* ── handlers ── */
  async function handleCreateClass(e) {
    e.preventDefault(); setClassError('');
    try {
      await createClass(newClassName, newClassSubject);
      setShowNewClass(false); setNewClassName(''); setNewClassSub('');
      loadClasses();
    } catch (err) { setClassError(err.message); }
  }

  async function handleDeleteClass(cls) {
    if (!window.confirm(`Delete "${cls.name}"? All students and records will be lost.`)) return;
    await deleteClass(cls.id);
    setSelected(''); setSummary([]); setTodayData(null); setRecords([]); setDates([]);
    loadClasses();
  }

  async function handleDeleteRecord(id) {
    if (!window.confirm('Remove this attendance record?')) return;
    await deleteAttendance(id);
    const params = { class_id: selectedClass };
    if (filterDate) params.date = filterDate;
    getAttendance(params).then(setRecords).catch(() => {});
  }

  async function handleManualSubmit(e) {
    e.preventDefault(); setManualMsg('');
    try {
      await markAttendanceManual({ student_id: showManual.id, class_id: parseInt(selectedClass), date: manualDate, status: manualStatus });
      setManualMsg(`✅ Marked ${manualStatus} for ${showManual.name} on ${manualDate}`);
      loadClassData(selectedClass);
    } catch (err) { setManualMsg(`❌ ${err.message}`); }
  }

  function exportCSV() {
    let rows;
    if (view === 'today' && todayData) {
      rows = [['Name', 'Student ID', 'Status', 'Scanned At'],
        ...todayData.students.map(s => [s.name, s.student_id, s.status, s.scanned_at ? fmtTime(s.scanned_at) : '—'])];
    } else if (view === 'summary') {
      rows = [['Name', 'Student ID', 'Present', 'Late', 'Absent', 'Total Sessions', 'Rate'],
        ...summary.map(s => [s.name, s.student_id, s.days_present, s.days_late || 0, s.absences, s.total_days, s.percentage + '%'])];
    } else {
      rows = [['Date', 'Student Name', 'Student ID', 'Time', 'Status'],
        ...records.map(r => [r.date, r.student_name, r.student_number, fmtTime(r.scanned_at), r.status])];
    }
    const csv  = rows.map(r => r.map(c => `"${c ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a    = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `attendance-class${selectedClass}-${view}.csv`; a.click();
  }

  const currentClass = classes.find(c => String(c.id) === selectedClass);
  const warnCount    = summary.filter(s => s.absences >= WARN_THRESHOLD).length;
  const lateCount    = summary.reduce((acc, s) => acc + (s.days_late || 0), 0);

  /* ── formatted date/time ── */
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <div className="page">

      {/* ── Date / Time header ── */}
      <div className="card mb-2" style={{ background: 'linear-gradient(135deg, #3e6f5c 0%, #449c72 100%)', border: 'none', padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.5rem' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,.8)', fontSize: '.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              📅 {dateStr}
            </div>
            <div style={{ color: '#fff', fontSize: '2rem', fontWeight: 800, letterSpacing: '.02em', lineHeight: 1.1, marginTop: '.2rem', fontVariantNumeric: 'tabular-nums' }}>
              {timeStr}
            </div>
          </div>
          <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,.2)', color: '#fff', border: '1px solid rgba(255,255,255,.35)', flexShrink: 0 }}
            onClick={() => setShowNewClass(true)}>
            + New Class
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>

        {/* Total classes */}
        <div className="stat-card">
          <div className="stat-icon">🏫</div>
          <div><div className="stat-value">{classes.length}</div><div className="stat-label">Classes</div></div>
        </div>

        {/* Total students in selected class */}
        <div className="stat-card" style={{ borderTop: selectedClass ? '3px solid #449c72' : undefined }}>
          <div className="stat-icon">👨‍🎓</div>
          <div>
            <div className="stat-value">{summary.length}</div>
            <div className="stat-label">
              {currentClass ? `Students in ${currentClass.name}` : 'Students'}
            </div>
          </div>
        </div>

        {/* Today: present */}
        <div className="stat-card" style={{ borderTop: '3px solid #449c72' }}>
          <div className="stat-icon" style={{ background: '#dcfce7' }}>✅</div>
          <div>
            <div className="stat-value" style={{ color: '#449c72' }}>{todayData?.present ?? '—'}</div>
            <div className="stat-label">Present Today</div>
          </div>
        </div>

        {/* Today: late */}
        <div className="stat-card" style={{ borderTop: '3px solid #f59e0b' }}>
          <div className="stat-icon" style={{ background: '#fef9c3' }}>🕐</div>
          <div>
            <div className="stat-value" style={{ color: '#d97706' }}>{todayData?.late ?? '—'}</div>
            <div className="stat-label">Late Today</div>
          </div>
        </div>

        {/* Today: absent */}
        <div className="stat-card" style={{ borderTop: '3px solid #ef4444' }}>
          <div className="stat-icon" style={{ background: '#fee2e2' }}>❌</div>
          <div>
            <div className="stat-value" style={{ color: '#dc2626' }}>{todayData?.absent ?? '—'}</div>
            <div className="stat-label">Absent Today</div>
          </div>
        </div>

        {/* Absence alerts */}
        <div className="stat-card">
          <div className="stat-icon">{warnCount > 0 ? '⚠️' : '📊'}</div>
          <div>
            <div className="stat-value" style={{ color: warnCount > 0 ? '#d97706' : '#3e6f5c' }}>{warnCount}</div>
            <div className="stat-label">Absence Alerts</div>
          </div>
        </div>

      </div>

      {/* ── Class tabs ── */}
      {classes.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">🏫</div>
          <div className="empty-title">No classes yet</div>
          <div className="empty-sub">Create your first class to start tracking attendance.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
          {classes.map(cls => {
            const studentCount = String(cls.id) === selectedClass ? summary.length : null;
            return (
              <button
                key={cls.id}
                className={`btn ${String(cls.id) === selectedClass ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSelected(String(cls.id))}
              >
                {cls.name}
                {cls.subject && <span style={{ opacity: .75, fontSize: '.78rem', marginLeft: '.3rem' }}>· {cls.subject}</span>}
                {studentCount !== null && (
                  <span style={{ marginLeft: '.4rem', background: 'rgba(255,255,255,.25)', padding: '.05rem .4rem', borderRadius: '8px', fontSize: '.72rem' }}>
                    {studentCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selectedClass && (
        <>
          {/* ── Toolbar ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.75rem', marginBottom: '1rem' }}>
            <div className="tabs">
              <button className={`tab-btn ${view === 'today'   ? 'active' : ''}`} onClick={() => setView('today')}>📋 Today</button>
              <button className={`tab-btn ${view === 'summary' ? 'active' : ''}`} onClick={() => setView('summary')}>📊 Summary</button>
              <button className={`tab-btn ${view === 'records' ? 'active' : ''}`} onClick={() => setView('records')}>🗂 All Records</button>
            </div>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              {view === 'records' && dates.length > 0 && (
                <select value={filterDate} onChange={e => setFilterDate(e.target.value)}
                  style={{ padding: '.38rem .7rem', borderRadius: '8px', border: '1.5px solid var(--border2)', fontSize: '.85rem' }}>
                  <option value="">All dates</option>
                  {dates.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
              <button className="btn btn-outline btn-sm" onClick={exportCSV}>⬇ CSV</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteClass(currentClass)}>Delete Class</button>
            </div>
          </div>

          {/* Late students highlight bar (shown on today/summary views) */}
          {view !== 'records' && todayData && todayData.late > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #fef9c3, #fef3c7)',
              border: '1.5px solid #fde68a', borderLeft: '4px solid #f59e0b',
              borderRadius: '10px', padding: '.85rem 1.1rem',
              display: 'flex', alignItems: 'flex-start', gap: '.65rem',
              marginBottom: '1rem', fontSize: '.875rem'
            }}>
              <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🕐</span>
              <div>
                <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '.2rem' }}>
                  {todayData.late} student{todayData.late !== 1 ? 's' : ''} arrived late today
                </div>
                <div style={{ color: '#92400e', fontSize: '.82rem' }}>
                  {todayData.students.filter(s => s.status === 'late').map(s => s.name).join(', ')}
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="center mt-3"><div className="spinner" /></div>
          ) : view === 'today' ? (
            <TodayTable
              todayData={todayData}
              onManualMark={s => { setShowManual(s); setManualDate(new Date().toISOString().split('T')[0]); setManualMsg(''); }}
            />
          ) : view === 'summary' ? (
            <>
              <AbsenceWarningRows summary={summary} />
              <SummaryTable
                summary={summary}
                onManualMark={s => { setShowManual(s); setManualDate(new Date().toISOString().split('T')[0]); setManualMsg(''); }}
              />
            </>
          ) : (
            <RecordsTable records={records} onDelete={handleDeleteRecord} />
          )}
        </>
      )}

      {/* ── New Class Modal ── */}
      {showNewClass && (
        <div className="modal-backdrop" onClick={() => setShowNewClass(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowNewClass(false)}>✕</button>
            <h2 className="modal-title">Create New Class</h2>
            {classError && <div className="alert alert-error"><span>⚠</span>{classError}</div>}
            <form onSubmit={handleCreateClass}>
              <div className="form-group">
                <label>Class Name *</label>
                <input value={newClassName} onChange={e => setNewClassName(e.target.value)} required placeholder="Grade 10 — Section A" autoFocus />
              </div>
              <div className="form-group">
                <label>Subject (optional)</label>
                <input value={newClassSubject} onChange={e => setNewClassSub(e.target.value)} placeholder="Mathematics" />
              </div>
              <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowNewClass(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Class</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Manual Attendance Modal ── */}
      {showManual && (
        <div className="modal-backdrop" onClick={() => setShowManual(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowManual(null)}>✕</button>
            <h2 className="modal-title">Mark Attendance Manually</h2>
            <p className="text-muted mb-2">
              Student: <strong>{showManual.name}</strong>
              <span className="badge badge-blue" style={{ marginLeft: '.5rem' }}>{showManual.student_id}</span>
            </p>
            {manualMsg && <div className={`alert ${manualMsg.startsWith('✅') ? 'alert-success' : 'alert-error'}`}>{manualMsg}</div>}
            <form onSubmit={handleManualSubmit}>
              <div className="form-group">
                <label>Date *</label>
                <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Status *</label>
                <select value={manualStatus} onChange={e => setManualStatus(e.target.value)}>
                  <option value="present">✓ Present</option>
                  <option value="late">🕐 Late</option>
                  <option value="absent">✗ Absent</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowManual(null)}>Close</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════
   TODAY TABLE  —  scan times + status
═══════════════════════════════════════ */
function TodayTable({ todayData, onManualMark }) {
  if (!todayData) return (
    <div className="card empty-state">
      <div className="empty-icon">📋</div>
      <div className="empty-title">No data yet</div>
      <div className="empty-sub">Select a class to see today's attendance.</div>
    </div>
  );

  const { students } = todayData;

  if (!students.length) return (
    <div className="card empty-state">
      <div className="empty-icon">👤</div>
      <div className="empty-title">No students enrolled</div>
      <div className="empty-sub">Add students in the Students page.</div>
    </div>
  );

  return (
    <div className="card">
      {/* Mini summary bar */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { icon: '👥', label: 'Total',   value: todayData.total,   color: '#3e6f5c' },
          { icon: '✅', label: 'Present', value: todayData.present, color: '#449c72' },
          { icon: '🕐', label: 'Late',    value: todayData.late,    color: '#d97706' },
          { icon: '❌', label: 'Absent',  value: todayData.absent,  color: '#dc2626' },
        ].map(({ icon, label, value, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <span>{icon}</span>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', color }}>{value}</span>
            <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{label}</span>
          </div>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Student</th>
              <th className="hide-mobile">Student ID</th>
              <th>Status</th>
              <th>Scanned At</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={s.id}>
                <td className="text-muted">{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td className="hide-mobile"><span className="badge badge-blue">{s.student_id}</span></td>
                <td><StatusBadge status={s.status} /></td>
                <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: '.875rem', color: s.scanned_at ? 'var(--text)' : 'var(--muted)' }}>
                  {fmtTime(s.scanned_at)}
                </td>
                <td>
                  <button className="btn btn-outline btn-sm" onClick={() => onManualMark(s)} title="Edit">✏️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════
   SUMMARY TABLE
═══════════════════════════════════════ */
function SummaryTable({ summary, onManualMark }) {
  if (!summary.length) return (
    <div className="card empty-state">
      <div className="empty-icon">👨‍🎓</div>
      <div className="empty-title">No students yet</div>
      <div className="empty-sub">Add students in the Students page to start tracking attendance.</div>
    </div>
  );

  return (
    <div className="card">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>ID</th>
              <th>Present</th>
              <th>Late</th>
              <th>Absent</th>
              <th>Sessions</th>
              <th>Rate</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {summary.map(s => {
              const pct = s.percentage;
              const rateColor = pct >= 75 ? 'badge-green' : pct >= 50 ? 'badge-yellow' : 'badge-red';
              return (
                <tr key={s.id}>
                  <td>
                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                    <AbsenceWarningBadge absences={s.absences} />
                  </td>
                  <td><span className="badge badge-blue">{s.student_id}</span></td>
                  <td style={{ color: '#449c72', fontWeight: 600 }}>{s.days_present}</td>
                  <td>
                    <span style={{ color: (s.days_late || 0) > 0 ? '#d97706' : 'inherit', fontWeight: (s.days_late || 0) > 0 ? 700 : 400 }}>
                      {s.days_late || 0}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: s.absences >= 3 ? '#dc2626' : s.absences >= 2 ? '#d97706' : 'inherit', fontWeight: s.absences >= 2 ? 700 : 400 }}>
                      {s.absences}
                    </span>
                  </td>
                  <td>{s.total_days}</td>
                  <td><span className={`badge ${rateColor}`}>{pct}%</span></td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => onManualMark(s)}>✏️ Mark</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════
   ALL RECORDS TABLE
═══════════════════════════════════════ */
function RecordsTable({ records, onDelete }) {
  if (!records.length) return (
    <div className="card empty-state">
      <div className="empty-icon">📋</div>
      <div className="empty-title">No records found</div>
      <div className="empty-sub">Try a different date filter or scan some QR codes.</div>
    </div>
  );

  return (
    <div className="card">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Student</th>
              <th className="hide-mobile">Student ID</th>
              <th>Time Scanned</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.date}</td>
                <td>{r.student_name}</td>
                <td className="hide-mobile"><span className="badge badge-blue">{r.student_number}</span></td>
                <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: '.875rem' }}>{fmtTime(r.scanned_at)}</td>
                <td><StatusBadge status={r.status} /></td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => onDelete(r.id)} title="Remove">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
