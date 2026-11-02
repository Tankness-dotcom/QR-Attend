import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { teacherLogin, studentLogin } from '../api';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [tab, setTab]           = useState('teacher');
  const [email, setEmail]       = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login }  = useAuth();
  const navigate   = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = tab === 'teacher'
        ? await teacherLogin(email, password)
        : await studentLogin(username, password);
      login(data.token, data.user);
      navigate(data.user.accountType === 'student' ? '/student/portal' : '/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  /* ── shared input style ── */
  const inputStyle = {
    width: '100%',
    padding: '.85rem 1rem .85rem 3rem',
    borderRadius: '50px',
    border: 'none',
    background: '#fff',
    fontSize: '1rem',
    color: '#3e6f5c',
    outline: 'none',
    boxShadow: '0 2px 8px rgba(62,111,92,.10)',
    fontFamily: 'Inter, sans-serif',
  };

  const inputWrap = {
    position: 'relative',
    marginBottom: '1rem',
  };

  const iconStyle = {
    position: 'absolute',
    left: '1.1rem',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '1.1rem',
    color: '#449c72',
    pointerEvents: 'none',
    lineHeight: 1,
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#c8e6c9',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontFamily: 'Inter, sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* ── Main content ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: '400px',
        padding: '2rem 1.5rem 0',
        zIndex: 1,
      }}>

        {/* Logo block */}
        <div style={{
          background: 'linear-gradient(135deg, #41a285 0%, #449c72 100%)',
          borderRadius: '24px',
          padding: '18px',
          marginBottom: '1.25rem',
          boxShadow: '0 8px 28px rgba(62,111,92,.35)',
        }}>
          <img
            src="/qrattend-logo.png"
            alt="QR-Attend Logo"
            style={{ width: '90px', height: '90px', objectFit: 'contain', display: 'block' }}
          />
        </div>

        {/* Title */}
        <h1 style={{ fontSize: '2.2rem', fontWeight: 900, margin: 0, letterSpacing: '.01em', lineHeight: 1.1 }}>
          <span style={{ color: '#2a4a3a' }}>QR-</span>
          <span style={{ color: '#3e6f5c' }}>Attend</span>
        </h1>
        <p style={{ color: '#5a8070', fontSize: '.9rem', margin: '.35rem 0 1.75rem', fontWeight: 500 }}>
          Offline Digital Attendance
        </p>

        {/* Role toggle */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,.5)',
          borderRadius: '50px',
          padding: '.25rem',
          width: '100%',
          marginBottom: '1.25rem',
          gap: '.25rem',
        }}>
          {[{ key: 'teacher', label: '👨‍🏫 Teacher' }, { key: 'student', label: '👨‍🎓 Student' }].map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); setError(''); }}
              style={{
                flex: 1,
                padding: '.5rem',
                border: 'none',
                borderRadius: '50px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '.85rem',
                fontFamily: 'Inter, sans-serif',
                transition: 'all .18s',
                background: tab === t.key ? '#3e6f5c' : 'transparent',
                color:      tab === t.key ? '#fff'    : '#5a8070',
                boxShadow:  tab === t.key ? '0 2px 10px rgba(62,111,92,.35)' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            width: '100%',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: '12px',
            padding: '.7rem 1rem',
            fontSize: '.85rem',
            marginBottom: '.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '.5rem',
          }}>
            ⚠ {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>

          {/* Email / Username */}
          <div style={inputWrap}>
            <span style={iconStyle}>👤</span>
            {tab === 'teacher' ? (
              <input
                type="email"
                placeholder="Admin Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                style={inputStyle}
              />
            ) : (
              <input
                type="text"
                placeholder="Student Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
                style={inputStyle}
              />
            )}
          </div>

          {/* Password */}
          <div style={inputWrap}>
            <span style={iconStyle}>🔒</span>
            <input
              type="password"
              placeholder="Enter Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          {/* Login button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '.9rem',
              background: loading ? '#5a8070' : '#3e6f5c',
              color: '#fff',
              border: 'none',
              borderRadius: '50px',
              fontSize: '1.05rem',
              fontWeight: 700,
              fontFamily: 'Inter, sans-serif',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(62,111,92,.4)',
              transition: 'background .15s, box-shadow .15s',
              marginTop: '.25rem',
              letterSpacing: '.02em',
            }}
          >
            {loading ? 'Signing in…' : 'Login'}
          </button>
        </form>

        {/* Sign-up hint */}
        <p style={{ marginTop: '1.1rem', fontSize: '.85rem', color: '#5a8070', textAlign: 'center' }}>
          Create account or sign-up?{' '}
          <span style={{ color: '#3e6f5c', fontWeight: 600, cursor: 'default' }}>
            Contact your Admin
          </span>
        </p>

        {/* Default credentials hint */}
        <div style={{
          marginTop: '.9rem',
          padding: '.75rem 1.1rem',
          background: 'rgba(255,255,255,.55)',
          borderRadius: '14px',
          fontSize: '.78rem',
          color: '#5a8070',
          width: '100%',
          textAlign: 'center',
        }}>
          <span style={{ fontWeight: 700, color: '#3e6f5c' }}>Default Admin: </span>
          admin@rnhs.edu.ph &nbsp;/&nbsp; admin123
        </div>
      </div>

      {/* ── Wave decoration ── */}
      <div style={{ width: '100%', lineHeight: 0, zIndex: 1, marginTop: '2rem' }}>
        <svg viewBox="0 0 400 80" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '80px' }}>
          <path
            d="M0,40 C60,80 120,0 200,40 C280,80 340,10 400,40 L400,80 L0,80 Z"
            fill="#449c72"
            opacity="0.6"
          />
          <path
            d="M0,55 C80,20 160,70 240,45 C310,25 360,60 400,50 L400,80 L0,80 Z"
            fill="#3e6f5c"
            opacity="0.85"
          />
        </svg>
      </div>
    </div>
  );
}
