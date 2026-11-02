import React, { useState, useEffect, useCallback } from 'react';
import {
  getClasses, getStudents, addStudent, bulkAddStudents,
  deleteStudent, createStudentAccount
} from '../api';
import QRCodeDisplay from '../components/QRCodeDisplay';
import AvatarUpload from '../components/AvatarUpload';

const EMPTY_FORM = {
  name: '', student_id: '', email: '',
  phone: '', lrn: '', grade_level: '', section: '', student_code: ''
};

/* Grade level options typical for PH SHS */
const GRADE_LEVELS = ['7', '8', '9', '10', '11', '12'];

export default function StudentsPage() {
  const [classes, setClasses]        = useState([]);
  const [selectedClass, setSelected] = useState('');
  const [students, setStudents]      = useState([]);
  const [loading, setLoading]        = useState(false);
  const [qrStudent, setQrStudent]    = useState(null);

  // Modals
  const [showAdd, setShowAdd]     = useState(false);
  const [showBulk, setShowBulk]   = useState(false);
  const [showAcct, setShowAcct]   = useState(null);  // student object
  const [viewStudent, setView]    = useState(null);  // student details drawer

  // Add form
  const [form, setForm]         = useState(EMPTY_FORM);
  const [addError, setAddError] = useState('');

  // Bulk
  const [bulkText, setBulkText] = useState('');
  const [bulkMsg, setBulkMsg]   = useState('');

  // Account creation
  const [acctUsername, setAcctUsername] = useState('');
  const [acctPassword, setAcctPassword] = useState('');
  const [acctMsg, setAcctMsg]           = useState('');

  useEffect(() => {
    getClasses().then(data => {
      setClasses(data);
      if (data.length > 0) setSelected(String(data[0].id));
    }).catch(() => {});
  }, []);

  const loadStudents = useCallback(async (classId) => {
    if (!classId) return setStudents([]);
    setLoading(true);
    try { setStudents(await getStudents(classId)); }
    catch { setStudents([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStudents(selectedClass); }, [selectedClass, loadStudents]);

  /* ── Handlers ── */
  async function handleAdd(e) {
    e.preventDefault();
    setAddError('');
    try {
      await addStudent({ ...form, class_id: parseInt(selectedClass) });
      setShowAdd(false);
      setForm(EMPTY_FORM);
      loadStudents(selectedClass);
    } catch (err) { setAddError(err.message); }
  }

  async function handleBulk(e) {
    e.preventDefault();
    setBulkMsg('');
    // Columns: name, student_id, email, phone, lrn, grade_level, section, student_code
    const lines = bulkText.trim().split('\n').filter(Boolean);
    const parsed = lines.map(line => {
      const [name, student_id, email, phone, lrn, grade_level, section, student_code] =
        line.split(',').map(s => s.trim());
      return { name, student_id, email, phone, lrn, grade_level, section, student_code };
    }).filter(s => s.name && s.student_id);

    if (!parsed.length)
      return setBulkMsg('No valid rows found. Format: Name, StudentID, Email, Phone, LRN, GradeLevel, Section, StudentCode');

    try {
      const res = await bulkAddStudents(parseInt(selectedClass), parsed);
      setBulkMsg(`✅ Added ${res.created} student(s)`);
      loadStudents(selectedClass);
      setBulkText('');
    } catch (err) { setBulkMsg(err.message); }
  }

  async function handleDeleteStudent(id, name) {
    if (!window.confirm(`Remove ${name}? Their attendance history will also be deleted.`)) return;
    await deleteStudent(id);
    loadStudents(selectedClass);
  }

  async function handleCreateAccount(e) {
    e.preventDefault();
    setAcctMsg('');
    try {
      await createStudentAccount(showAcct.id, acctUsername, acctPassword);
      setAcctMsg(`✅ Account created! Username: ${acctUsername}`);
      setAcctUsername(''); setAcctPassword('');
      loadStudents(selectedClass);
    } catch (err) { setAcctMsg(`❌ ${err.message}`); }
  }

  /* ── Small helpers ── */
  const f = (v) => v || '—';

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">👨‍🎓 Students</h1>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          {selectedClass && (
            <>
              <button className="btn btn-outline" onClick={() => setShowBulk(true)}>📋 Bulk Import</button>
              <button className="btn btn-primary" onClick={() => { setAddError(''); setForm(EMPTY_FORM); setShowAdd(true); }}>
                + Add Student
              </button>
            </>
          )}
        </div>
      </div>

      {/* Class selector */}
      <div className="card mb-2">
        <div className="form-group" style={{ margin: 0 }}>
          <label>Class</label>
          <select value={selectedClass} onChange={e => setSelected(e.target.value)}>
            <option value="">— Select a class —</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.subject ? ` · ${c.subject}` : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {!selectedClass && (
        <div className="card empty-state">
          <div className="empty-icon">🏫</div>
          <div className="empty-title">Select a class</div>
          <div className="empty-sub">Choose a class above to manage its students.</div>
        </div>
      )}

      {selectedClass && loading && (
        <div className="center mt-3"><div className="spinner" /></div>
      )}

      {selectedClass && !loading && (
        <div className="card">
          <div className="flex-between mb-2">
            <span className="text-muted text-small">{students.length} student{students.length !== 1 ? 's' : ''} enrolled</span>
          </div>

          {students.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👤</div>
              <div className="empty-title">No students yet</div>
              <div className="empty-sub">Add students individually or use Bulk Import.</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Photo</th>
                    <th>Name</th>
                    <th>LRN</th>
                    <th>Grade &amp; Section</th>
                    <th className="hide-mobile">Strand Code</th>
                    <th className="hide-mobile">Phone</th>
                    <th>Account</th>
                    <th>QR</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.id}>
                      <td className="text-muted">{i + 1}</td>
                      <td><AvatarUpload photo={s.photo} name={s.name} size={36} editable={false} /></td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                        <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>
                          <span className="badge badge-blue" style={{ fontSize: '.7rem' }}>{s.student_id}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '.85rem' }}>{f(s.lrn)}</td>
                      <td style={{ fontSize: '.85rem' }}>
                        {s.grade_level ? (
                          <span>Gr. {s.grade_level}{s.section ? ` — ${s.section}` : ''}</span>
                        ) : f(null)}
                      </td>
                      <td className="hide-mobile">
                        {s.student_code
                          ? <span className="badge badge-teal">{s.student_code}</span>
                          : <span className="text-muted">—</span>}
                      </td>
                      <td className="hide-mobile" style={{ fontSize: '.85rem' }}>{f(s.phone)}</td>
                      <td>
                        {s.has_account ? (
                          <span className="badge badge-green">✓ Active</span>
                        ) : (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => { setShowAcct(s); setAcctMsg(''); setAcctUsername(s.student_id); setAcctPassword(''); }}
                          >
                            + Create
                          </button>
                        )}
                      </td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => setQrStudent(s)}>🔲</button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '.3rem' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            title="View details"
                            onClick={() => setView(s)}
                          >👁</button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteStudent(s.id, s.name)}
                          >✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ ADD STUDENT MODAL ══ */}
      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
            <h2 className="modal-title">Add Student</h2>
            {addError && <div className="alert alert-error"><span>⚠</span> {addError}</div>}
            <form onSubmit={handleAdd}>
              {/* Row 1 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Full Name *</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    required placeholder="Juan dela Cruz" autoFocus />
                </div>
                <div className="form-group">
                  <label>LRN (Learner Reference No.)</label>
                  <input value={form.lrn} onChange={e => setForm({...form, lrn: e.target.value})}
                    placeholder="123456789012" maxLength={12} />
                </div>
                <div className="form-group">
                  <label>Student ID</label>
                  <input value={form.student_id} onChange={e => setForm({...form, student_id: e.target.value})}
                    placeholder="2024-0001" />
                </div>
                <div className="form-group">
                  <label>Grade Level *</label>
                  <select value={form.grade_level} onChange={e => setForm({...form, grade_level: e.target.value})} required>
                    <option value="">— Select grade —</option>
                    {GRADE_LEVELS.map(g => <option key={g} value={g}>Grade {g}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Section *</label>
                  <input value={form.section} onChange={e => setForm({...form, section: e.target.value})}
                    required placeholder="e.g. Rizal, Orchid" />
                </div>
                <div className="form-group">
                  <label>Student Code (Strand) *</label>
                  <input value={form.student_code} onChange={e => setForm({...form, student_code: e.target.value})}
                    required placeholder="e.g. STEM, ABM, HUMSS" />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                    placeholder="09xxxxxxxxx" type="tel" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Email (optional)</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                    placeholder="juan@school.edu.ph" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end', marginTop: '.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Student</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ BULK IMPORT MODAL ══ */}
      {showBulk && (
        <div className="modal-backdrop" onClick={() => setShowBulk(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowBulk(false)}>✕</button>
            <h2 className="modal-title">Bulk Import Students</h2>

            <div className="alert alert-info" style={{ fontSize: '.82rem' }}>
              <span>ℹ</span>
              <div>
                <strong>Column order (comma-separated, one student per line):</strong><br />
                <code>Name, StudentID, Email, Phone, LRN, GradeLevel, Section, StudentCode</code><br />
                <span style={{ opacity: .8 }}>Email, Phone are optional. LRN, GradeLevel, Section and StudentCode are recommended.</span>
              </div>
            </div>

            {bulkMsg && <div className={`alert ${bulkMsg.startsWith('✅') ? 'alert-success' : 'alert-error'}`}>{bulkMsg}</div>}

            <form onSubmit={handleBulk}>
              <div className="form-group">
                <textarea
                  style={{ width: '100%', height: '200px', padding: '.65rem', border: '1.5px solid var(--border2)', borderRadius: '8px', fontFamily: 'monospace', fontSize: '.82rem', resize: 'vertical', lineHeight: 1.6 }}
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  placeholder={
                    'Juan dela Cruz, 2024-001, juan@school.ph, 09171234567, 123456789012, 11, Rizal, STEM\n' +
                    'Maria Santos, 2024-002, , , 234567890123, 12, Orchid, ABM\n' +
                    'Jose Reyes, 2024-003, jose@school.ph, 09281234567, 345678901234, 10, Sampaguita, HUMSS'
                  }
                />
              </div>
              <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowBulk(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Import</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ CREATE ACCOUNT MODAL ══ */}
      {showAcct && (
        <div className="modal-backdrop" onClick={() => setShowAcct(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAcct(null)}>✕</button>
            <h2 className="modal-title">Create Student Account</h2>
            <div style={{ background: 'var(--primary-light)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: '.4rem' }}>{showAcct.name}</div>
              <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', fontSize: '.82rem', color: 'var(--muted)' }}>
                <span>🪪 {showAcct.student_id}</span>
                {showAcct.lrn && <span>📋 LRN: {showAcct.lrn}</span>}
                {showAcct.grade_level && <span>📚 Gr. {showAcct.grade_level}{showAcct.section ? ` — ${showAcct.section}` : ''}</span>}
                {showAcct.student_code && <span className="badge badge-teal">{showAcct.student_code}</span>}
              </div>
            </div>
            <div className="alert alert-info">
              <span>ℹ</span> Students can log in to view their own attendance and QR code only.
            </div>
            {acctMsg && <div className={`alert ${acctMsg.startsWith('✅') ? 'alert-success' : 'alert-error'}`}>{acctMsg}</div>}
            <form onSubmit={handleCreateAccount}>
              <div className="form-group">
                <label>Username *</label>
                <input value={acctUsername} onChange={e => setAcctUsername(e.target.value)} required placeholder="e.g. juan.delacruz" />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input type="password" value={acctPassword} onChange={e => setAcctPassword(e.target.value)} required placeholder="Set a password" />
              </div>
              <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAcct(null)}>Close</button>
                <button type="submit" className="btn btn-primary">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ STUDENT DETAILS MODAL ══ */}
      {viewStudent && (
        <div className="modal-backdrop" onClick={() => setView(null)}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setView(null)}>✕</button>
            <h2 className="modal-title">Student Details</h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #449c72, #c8e6c9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>👤</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent)' }}>{viewStudent.name}</div>
                <span className="badge badge-blue">{viewStudent.student_id}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.65rem' }}>
              {[
                { label: '📋 LRN',           value: viewStudent.lrn },
                { label: '📚 Grade Level',   value: viewStudent.grade_level ? `Grade ${viewStudent.grade_level}` : null },
                { label: '🏫 Section',       value: viewStudent.section },
                { label: '🎓 Strand Code',   value: viewStudent.student_code },
                { label: '📞 Phone',         value: viewStudent.phone },
                { label: '✉️ Email',         value: viewStudent.email },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'var(--bg)', borderRadius: '8px', padding: '.65rem .85rem' }}>
                  <div style={{ fontSize: '.75rem', color: 'var(--muted)', fontWeight: 600, marginBottom: '.2rem' }}>{label}</div>
                  <div style={{ fontWeight: 600, color: value ? 'var(--text)' : 'var(--muted)', fontSize: '.9rem' }}>
                    {value || '—'}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '.5rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => { setView(null); setQrStudent(viewStudent); }}>🔲 View QR</button>
              <button className="btn btn-outline" onClick={() => setView(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrStudent && <QRCodeDisplay student={qrStudent} onClose={() => setQrStudent(null)} />}
    </div>
  );
}
