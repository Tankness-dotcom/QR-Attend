import React, { useState, useEffect } from 'react';
import { getMyStudentInfo, getMyStudentQR, uploadStudentPhoto, removeStudentPhoto, changeStudentPassword } from '../api';
import { useAuth } from '../context/AuthContext';
import AvatarUpload from '../components/AvatarUpload';

export default function StudentPortalPage() {
  const { user, refreshUser } = useAuth();
  const [info, setInfo]         = useState(null);
  const [qr, setQr]             = useState(null);
  const [loading, setLoading]   = useState(true);
  const [qrLoading, setQrLoading] = useState(false);
  const [tab, setTab]           = useState('profile');

  /* photo */
  const [photoMsg, setPhotoMsg]     = useState('');
  const [photoSaving, setPhotoSaving] = useState(false);

  /* password */
  const [pwForm, setPwForm]   = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg]     = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  async function handleUploadPhoto(dataUrl) {
    setPhotoMsg(''); setPhotoSaving(true);
    try { await uploadStudentPhoto(dataUrl); await refreshUser(); setPhotoMsg('success:Photo updated!'); }
    catch (err) { setPhotoMsg('error:' + err.message); }
    finally { setPhotoSaving(false); }
  }

  async function handleRemovePhoto() {
    if (!window.confirm('Remove your profile picture?')) return;
    setPhotoSaving(true);
    try { await removeStudentPhoto(); await refreshUser(); setPhotoMsg('success:Photo removed.'); }
    catch (err) { setPhotoMsg('error:' + err.message); }
    finally { setPhotoSaving(false); }
  }

  async function handleChangePassword(e) {
    e.preventDefault(); setPwMsg('');
    if (pwForm.next !== pwForm.confirm) return setPwMsg('error:New passwords do not match.');
    if (pwForm.next.length < 6) return setPwMsg('error:Password must be at least 6 characters.');
    setPwSaving(true);
    try {
      await changeStudentPassword(pwForm.current, pwForm.next);
      setPwMsg('success:Password changed successfully.');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err) { setPwMsg('error:' + err.message); }
    finally { setPwSaving(false); }
  }

  function Msg({ raw }) {
    if (!raw) return null;
    const [type, ...parts] = raw.split(':');
    return <div className={`alert alert-${type === 'success' ? 'success' : 'error'}`} style={{ marginTop: '.75rem' }}>{type === 'success' ? '✓' : '⚠'} {parts.join(':')}</div>;
  }

  useEffect(() => {
    getMyStudentInfo()
      .then(setInfo)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function loadQR() {
    if (qr) return;
    setQrLoading(true);
    try { setQr(await getMyStudentQR()); }
    catch {}
    finally { setQrLoading(false); }
  }

  useEffect(() => {
    if (tab === 'qr') loadQR();
  }, [tab]); // eslint-disable-line

  if (loading) {
    return <div className="center" style={{ minHeight: '60vh' }}><div className="spinner" /></div>;
  }

  if (!info) {
    return (
      <div className="page">
        <div className="card empty-state">
          <div className="empty-icon">⚠️</div>
          <div className="empty-title">Could not load your information</div>
          <div className="empty-sub">Please try logging out and back in.</div>
        </div>
      </div>
    );
  }

  const { student, attendance, summary } = info;
  const absenceCount = summary.totalAbsent;

  function AbsenceWarning() {
    if (absenceCount < 2) return null;
    const isCritical = absenceCount >= 3;
    return (
      <div className={`absence-warning ${isCritical ? 'critical' : ''}`} style={{ marginBottom: '1.25rem' }}>
        <div className="aw-icon">{isCritical ? '🚨' : '⚠️'}</div>
        <div>
          <div className="aw-title" style={{ color: isCritical ? '#991b1b' : '#9a3412' }}>
            {isCritical ? 'Critical Absence Alert' : 'Absence Warning'}
          </div>
          <div className="aw-body">
            You have <strong>{absenceCount} absence{absenceCount !== 1 ? 's' : ''}</strong> in {student.class_name}.
            {isCritical
              ? ' This is a critical level. Please speak with your teacher immediately.'
              : ' Please make sure to attend your classes regularly.'}
          </div>
        </div>
      </div>
    );
  }

  function InfoRow({ icon, label, value }) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '.75rem', padding: '.65rem 0', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '1.1rem', width: '22px', textAlign: 'center', flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '.75rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
          <div style={{ fontWeight: 600, color: value ? 'var(--text)' : 'var(--muted)', marginTop: '.1rem' }}>
            {value || '—'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: '860px' }}>

      {/* ── Profile header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <AvatarUpload
            photo={user?.photo}
            name={student.name}
            size={72}
            onUpload={handleUploadPhoto}
            onRemove={handleRemovePhoto}
            editable={!photoSaving}
          />
          {photoSaving && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.7)', borderRadius: '50%' }}>
              <div className="spinner" style={{ width: 22, height: 22, borderWidth: 2 }} />
            </div>
          )}
        </div>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: '1.4rem', color: '#3e6f5c' }}>{student.name}</h1>
          <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginTop: '.35rem' }}>
            {student.lrn          && <span className="badge badge-teal">LRN: {student.lrn}</span>}
            {student.grade_level  && <span className="badge badge-green">Gr. {student.grade_level}{student.section ? ` — ${student.section}` : ''}</span>}
            {student.student_code && <span className="badge badge-purple">{student.student_code}</span>}
            <span className="badge badge-blue">{student.class_name}</span>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div><div className="stat-value">{summary.totalSessions}</div><div className="stat-label">Total Sessions</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div>
            <div className="stat-value" style={{ color: '#449c72' }}>{summary.totalPresent}</div>
            <div className="stat-label">Days Present</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">{absenceCount >= 3 ? '🚨' : absenceCount >= 2 ? '⚠️' : '📋'}</div>
          <div>
            <div className="stat-value" style={{ color: absenceCount >= 3 ? '#dc2626' : absenceCount >= 2 ? '#d97706' : '#3e6f5c' }}>
              {absenceCount}
            </div>
            <div className="stat-label">Absences</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div>
            <div className="stat-value" style={{ color: summary.totalSessions > 0 ? (summary.totalPresent / summary.totalSessions >= .75 ? '#449c72' : '#dc2626') : '#3e6f5c' }}>
              {summary.totalSessions > 0 ? Math.round((summary.totalPresent / summary.totalSessions) * 100) + '%' : '—'}
            </div>
            <div className="stat-label">Attendance Rate</div>
          </div>
        </div>
      </div>

      <AbsenceWarning />

      {/* ── Tabs ── */}
      <div className="tabs mb-2">
        <button className={`tab-btn ${tab === 'profile'     ? 'active' : ''}`} onClick={() => setTab('profile')}>👤 My Info</button>
        <button className={`tab-btn ${tab === 'attendance'  ? 'active' : ''}`} onClick={() => setTab('attendance')}>📋 Attendance</button>
        <button className={`tab-btn ${tab === 'qr'          ? 'active' : ''}`} onClick={() => setTab('qr')}>🔲 My QR Code</button>
        <button className={`tab-btn ${tab === 'settings'    ? 'active' : ''}`} onClick={() => setTab('settings')}>⚙️ Settings</button>
      </div>

      {/* ════════════ PROFILE TAB ════════════ */}
      {tab === 'profile' && (
        <div className="card">
          <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: '.75rem', fontSize: '.95rem' }}>
            Personal Information
          </div>
          <InfoRow icon="👤" label="Full Name"          value={student.name} />
          <InfoRow icon="🪪" label="Student ID"         value={student.student_id} />
          <InfoRow icon="📋" label="LRN"                value={student.lrn} />
          <InfoRow icon="📚" label="Grade Level"        value={student.grade_level ? `Grade ${student.grade_level}` : null} />
          <InfoRow icon="🏫" label="Section"            value={student.section} />
          <InfoRow icon="🎓" label="Strand / Code"      value={student.student_code} />
          <InfoRow icon="📞" label="Phone Number"       value={student.phone} />
          <InfoRow icon="✉️"  label="Email"             value={student.email} />
          <InfoRow icon="🏛️" label="Class"             value={`${student.class_name}${student.subject ? ` · ${student.subject}` : ''}`} />
        </div>
      )}

      {/* ════════════ ATTENDANCE TAB ════════════ */}
      {tab === 'attendance' && (
        <div className="card">
          {attendance.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div className="empty-title">No attendance records yet</div>
              <div className="empty-sub">Your attendance will appear here once your QR code is scanned.</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th className="hide-mobile">Class</th>
                    <th>Time Scanned</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((a, i) => (
                    <tr key={a.id}>
                      <td className="text-muted">{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{a.date}</td>
                      <td className="hide-mobile text-muted">{a.class_name}</td>
                      <td className="text-muted" style={{ fontSize: '.85rem' }}>
                        {new Date(a.scanned_at).toLocaleTimeString()}
                      </td>
                      <td>
                        <span className={`badge ${a.status === 'present' ? 'badge-green' : 'badge-red'}`}>
                          {a.status === 'present' ? '✓ Present' : '✗ Absent'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════════════ QR TAB ════════════ */}
      {tab === 'qr' && (
        <div className="card text-center" style={{ padding: '2.5rem' }}>
          <h3 style={{ fontWeight: 700, color: '#3e6f5c', marginBottom: '.5rem' }}>Your Unique QR Code</h3>
          <p className="text-muted mb-2">Present this QR code to your teacher when taking attendance.</p>

          {qrLoading && <div className="center" style={{ padding: '2rem' }}><div className="spinner" /></div>}

          {qr && !qrLoading && (
            <div>
              <img
                src={qr.qr}
                alt="My QR Code"
                style={{ width: '260px', height: '260px', borderRadius: '12px', border: '3px solid #c8e6c9', display: 'block', margin: '0 auto 1.25rem' }}
              />
              <p style={{ fontWeight: 700, fontSize: '1.1rem', color: '#3e6f5c' }}>{qr.student_name}</p>
              <p className="text-muted">Student ID: {qr.student_id}</p>

              <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center', marginTop: '1.25rem' }}>
                <a href={qr.qr} download={`QR-${qr.student_id}.png`} className="btn btn-outline">⬇ Download</a>
                <button className="btn btn-primary" onClick={() => {
                  const w = window.open('', '_blank');
                  w.document.write(`<html><head><title>QR Code - ${qr.student_name}</title>
                    <style>body{font-family:Arial,sans-serif;text-align:center;padding:2rem}
                    img{width:280px;height:280px;border-radius:8px}
                    h2{margin:.75rem 0 .25rem}p{color:#666}</style></head>
                    <body><img src="${qr.qr}"/><h2>${qr.student_name}</h2><p>ID: ${qr.student_id}</p></body></html>`);
                  w.document.close(); w.focus(); w.print(); w.close();
                }}>🖨 Print</button>
              </div>

              <div style={{ marginTop: '1rem', background: '#f0faf5', borderRadius: '8px', padding: '.75rem', fontSize: '.75rem', color: '#5a8070', wordBreak: 'break-all' }}>
                <strong>Token:</strong> {qr.qr_token}
              </div>
            </div>
          )}
        </div>
      )}
      {/* ════════════ SETTINGS TAB ════════════ */}
      {tab === 'settings' && (
        <div className="card">
          <h3 style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: '1rem' }}>🖼 Profile Picture</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '.5rem' }}>
            <AvatarUpload
              photo={user?.photo}
              name={student.name}
              size={88}
              onUpload={handleUploadPhoto}
              onRemove={handleRemovePhoto}
              editable={!photoSaving}
            />
            <div style={{ fontSize: '.85rem', color: 'var(--muted)' }}>
              Click the circle to upload a photo.<br />
              Supported formats: JPG, PNG, GIF, WebP (max 3 MB).
            </div>
          </div>
          <Msg raw={photoMsg} />

          <div style={{ height: '1px', background: 'var(--border)', margin: '1.5rem 0' }} />

          <h3 style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: '1rem' }}>🔒 Change Password</h3>
          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label>Current Password *</label>
              <input type="password" placeholder="Current password" value={pwForm.current}
                onChange={e => setPwForm({ ...pwForm, current: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>New Password *</label>
              <input type="password" placeholder="At least 6 characters" value={pwForm.next}
                onChange={e => setPwForm({ ...pwForm, next: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Confirm New Password *</label>
              <input type="password" placeholder="Repeat new password" value={pwForm.confirm}
                onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} required />
            </div>
            <Msg raw={pwMsg} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={pwSaving}>
                {pwSaving ? 'Saving…' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
