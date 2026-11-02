import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AvatarUpload from '../components/AvatarUpload';
import { uploadTeacherPhoto, removeTeacherPhoto, changeTeacherPassword } from '../api';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();

  /* ── Photo state ── */
  const [photoMsg, setPhotoMsg]   = useState('');
  const [photoSaving, setPhotoSaving] = useState(false);

  /* ── Password state ── */
  const [pwForm, setPwForm]     = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg]       = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  async function handleUploadPhoto(dataUrl) {
    setPhotoMsg('');
    setPhotoSaving(true);
    try {
      await uploadTeacherPhoto(dataUrl);
      await refreshUser();
      setPhotoMsg('success:Photo updated!');
    } catch (err) {
      setPhotoMsg('error:' + err.message);
    } finally { setPhotoSaving(false); }
  }

  async function handleRemovePhoto() {
    if (!window.confirm('Remove your profile picture?')) return;
    setPhotoSaving(true);
    try {
      await removeTeacherPhoto();
      await refreshUser();
      setPhotoMsg('success:Photo removed.');
    } catch (err) {
      setPhotoMsg('error:' + err.message);
    } finally { setPhotoSaving(false); }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwMsg('');
    if (pwForm.next !== pwForm.confirm) return setPwMsg('error:New passwords do not match.');
    if (pwForm.next.length < 6) return setPwMsg('error:Password must be at least 6 characters.');
    setPwSaving(true);
    try {
      await changeTeacherPassword(pwForm.current, pwForm.next);
      setPwMsg('success:Password changed successfully.');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPwMsg('error:' + err.message);
    } finally { setPwSaving(false); }
  }

  function Msg({ raw }) {
    if (!raw) return null;
    const [type, ...parts] = raw.split(':');
    return (
      <div className={`alert alert-${type === 'success' ? 'success' : 'error'}`} style={{ marginTop: '.75rem' }}>
        {type === 'success' ? '✓' : '⚠'} {parts.join(':')}
      </div>
    );
  }

  const roleLabel = user?.role === 'admin' ? 'Administrator' : 'Teacher';
  const roleChip  = user?.role === 'admin' ? 'role-admin' : 'role-teacher';

  return (
    <div className="page" style={{ maxWidth: '640px' }}>
      <div className="page-header">
        <h1 className="page-title">👤 My Profile</h1>
      </div>

      {/* ── Profile card ── */}
      <div className="card mb-2">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <AvatarUpload
              photo={user?.photo}
              name={user?.name}
              size={100}
              onUpload={handleUploadPhoto}
              onRemove={handleRemovePhoto}
              editable={!photoSaving}
            />
            {photoSaving && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.7)', borderRadius: '50%' }}>
                <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
              </div>
            )}
          </div>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--accent)' }}>{user?.name}</h2>
            <p className="text-muted" style={{ marginTop: '.2rem' }}>{user?.email}</p>
            <span className={`role-chip ${roleChip}`} style={{ marginTop: '.5rem', display: 'inline-flex' }}>
              {roleLabel}
            </span>
          </div>
        </div>

        <div style={{ marginTop: '1rem', padding: '.75rem', background: 'var(--bg)', borderRadius: '8px', fontSize: '.82rem', color: 'var(--muted)' }}>
          💡 Click your photo to upload a new picture. Images are automatically resized to 400×400 px.
        </div>
        <Msg raw={photoMsg} />
      </div>

      {/* ── Change password card ── */}
      <div className="card">
        <h3 style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: '1rem' }}>🔒 Change Password</h3>
        <form onSubmit={handleChangePassword}>
          <div className="form-group">
            <label>Current Password *</label>
            <input
              type="password"
              placeholder="Enter your current password"
              value={pwForm.current}
              onChange={e => setPwForm({ ...pwForm, current: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>New Password *</label>
            <input
              type="password"
              placeholder="At least 6 characters"
              value={pwForm.next}
              onChange={e => setPwForm({ ...pwForm, next: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Confirm New Password *</label>
            <input
              type="password"
              placeholder="Repeat new password"
              value={pwForm.confirm}
              onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
              required
            />
          </div>
          <Msg raw={pwMsg} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={pwSaving}>
              {pwSaving ? 'Saving…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
