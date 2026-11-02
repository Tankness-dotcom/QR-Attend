import React, { useState, useEffect, useCallback } from 'react';
import { getTeachers, registerTeacher, deleteTeacher } from '../api';
import { useAuth } from '../context/AuthContext';
import AvatarUpload from '../components/AvatarUpload';

export default function TeachersPage() {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'teacher' });
  const [formError, setFormError] = useState('');

  const loadTeachers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTeachers();
      setTeachers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTeachers(); }, [loadTeachers]);

  async function handleAdd(e) {
    e.preventDefault();
    setFormError('');
    try {
      await registerTeacher(form);
      setShowAdd(false);
      setForm({ name: '', email: '', password: '', role: 'teacher' });
      setSuccess(`✅ Account created for ${form.name}`);
      loadTeachers();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) { setFormError(err.message); }
  }

  async function handleDelete(teacher) {
    if (teacher.id === user.id) return;
    if (!window.confirm(`Delete account for ${teacher.name}? This cannot be undone.`)) return;
    try {
      await deleteTeacher(teacher.id);
      loadTeachers();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">👨‍🏫 Teacher Accounts</h1>
        <button className="btn btn-primary" onClick={() => { setFormError(''); setShowAdd(true); }}>
          + Add Teacher
        </button>
      </div>

      {error   && <div className="alert alert-error"  ><span>⚠</span> {error}</div>}
      {success && <div className="alert alert-success"><span>✓</span> {success}</div>}

      {/* Info card */}
      <div className="alert alert-info mb-2">
        <span>ℹ</span>
        <div>
          <strong>Role Guide:</strong>
          {' '}<span className="role-chip role-teacher">Teacher</span> can manage their own classes, students, and attendance.
          {' '}<span className="role-chip role-admin">Admin</span> can also manage teacher accounts.
        </div>
      </div>

      {loading ? (
        <div className="center mt-3"><div className="spinner" /></div>
      ) : (
        <div className="card">
          {teachers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👨‍🏫</div>
              <div className="empty-title">No teacher accounts yet</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Photo</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th className="hide-mobile">Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((t, i) => (
                    <tr key={t.id}>
                      <td className="text-muted">{i + 1}</td>
                      <td>
                        <AvatarUpload photo={t.photo} name={t.name} size={38} editable={false} />
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {t.name}
                        {t.id === user.id && (
                          <span className="badge badge-green" style={{ marginLeft: '.5rem', fontSize: '.7rem' }}>You</span>
                        )}
                      </td>
                      <td className="text-muted">{t.email}</td>
                      <td>
                        <span className={`role-chip ${t.role === 'admin' ? 'role-admin' : 'role-teacher'}`}>
                          {t.role === 'admin' ? '🛡 Admin' : '👨‍🏫 Teacher'}
                        </span>
                      </td>
                      <td className="hide-mobile text-muted" style={{ fontSize: '.82rem' }}>
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        {t.id !== user.id ? (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(t)}
                          >
                            Remove
                          </button>
                        ) : (
                          <span className="text-muted text-small">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Teacher Modal */}
      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
            <h2 className="modal-title">Create Teacher Account</h2>
            {formError && <div className="alert alert-error"><span>⚠</span> {formError}</div>}
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  required placeholder="Teacher's full name" autoFocus
                />
              </div>
              <div className="form-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})}
                  required placeholder="teacher@rnhs.edu.ph"
                />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  required placeholder="Set a strong password"
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="teacher">Teacher — manage own classes only</option>
                  <option value="admin">Admin — full access including teacher management</option>
                </select>
              </div>

              <div style={{ background: '#f0faf5', borderRadius: '8px', padding: '.75rem', fontSize: '.82rem', color: '#5a8070', marginBottom: '1rem' }}>
                <strong>Note:</strong> After creation, share the email and password with the teacher so they can log in.
              </div>

              <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
