import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { teacherLogin, studentLogin, lookupStudentById, studentSelfRegister } from '../api';
import { useAuth } from '../context/AuthContext';
import { sessionList } from '../offline/db';

/* ══════════════════════════════════════
   Shared styles
══════════════════════════════════════ */
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
const inputWrap  = { position: 'relative', marginBottom: '1rem' };
const iconStyle  = { position: 'absolute', left: '1.1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem', color: '#449c72', pointerEvents: 'none', lineHeight: 1 };
const btnGreen   = { width: '100%', padding: '.9rem', background: '#3e6f5c', color: '#fff', border: 'none', borderRadius: '50px', fontSize: '1.05rem', fontWeight: 700, fontFamily: 'Inter, sans-serif', cursor: 'pointer', boxShadow: '0 4px 16px rgba(62,111,92,.4)', letterSpacing: '.02em' };
const btnOutline = { width: '100%', padding: '.9rem', background: 'rgba(255,255,255,.6)', color: '#3e6f5c', border: '2px solid #3e6f5c', borderRadius: '50px', fontSize: '1.05rem', fontWeight: 700, fontFamily: 'Inter, sans-serif', cursor: 'pointer', letterSpacing: '.02em' };

function ErrorBox({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ width: '100%', background: '#fee2e2', color: '#991b1b', borderRadius: '12px', padding: '.7rem 1rem', fontSize: '.85rem', marginBottom: '.75rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
      ⚠ {msg}
    </div>
  );
}

function SuccessBox({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ width: '100%', background: '#dcfce7', color: '#166534', borderRadius: '12px', padding: '.7rem 1rem', fontSize: '.85rem', marginBottom: '.75rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
      ✅ {msg}
    </div>
  );
}

/* ══════════════════════════════════════
   WRAPPER LAYOUT (shared by all screens)
══════════════════════════════════════ */
function PageShell({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#c8e6c9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: '400px', padding: '2rem 1.5rem 0', zIndex: 1 }}>
        {children}
      </div>
      <div style={{ width: '100%', lineHeight: 0, zIndex: 1, marginTop: '2rem' }}>
        <svg viewBox="0 0 400 80" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '80px' }}>
          <path d="M0,40 C60,80 120,0 200,40 C280,80 340,10 400,40 L400,80 L0,80 Z" fill="#449c72" opacity="0.6" />
          <path d="M0,55 C80,20 160,70 240,45 C310,25 360,60 400,50 L400,80 L0,80 Z" fill="#3e6f5c" opacity="0.85" />
        </svg>
      </div>
    </div>
  );
}

function LogoHeader() {
  return (
    <>
      <div style={{ background: 'linear-gradient(135deg, #41a285 0%, #449c72 100%)', borderRadius: '24px', padding: '18px', marginBottom: '1.25rem', boxShadow: '0 8px 28px rgba(62,111,92,.35)' }}>
        <img src="/qrattend-logo.png" alt="QR-Attend Logo" style={{ width: '90px', height: '90px', objectFit: 'contain', display: 'block' }} />
      </div>
      <h1 style={{ fontSize: '2.2rem', fontWeight: 900, margin: 0, letterSpacing: '.01em', lineHeight: 1.1 }}>
        <span style={{ color: '#2a4a3a' }}>QR-</span><span style={{ color: '#3e6f5c' }}>Attend</span>
      </h1>
    </>
  );
}

/* ══════════════════════════════════════
   SCREEN 1 — LOGIN
══════════════════════════════════════ */
function LoginScreen({ onCreateAccount }) {
  const [tab, setTab]           = useState('teacher');
  const [email, setEmail]       = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [savedSessions, setSaved] = useState([]);
  const { login } = useAuth();
  const navigate  = useNavigate();

  /* Track online/offline */
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  /* Load saved sessions for quick-login */
  useEffect(() => {
    sessionList().then(setSaved).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const data = tab === 'teacher'
        ? await teacherLogin(email, password)
        : await studentLogin(username, password);
      login(data.token, data.user);
      navigate(data.user.accountType === 'student' ? '/student/portal' : '/dashboard');
    } catch (err) { setError(err.message || 'Login failed'); }
    finally { setLoading(false); }
  }

  /* Quick-login from a saved session tile */
  async function handleQuickLogin(session) {
    setError('');
    const isTeacher = session.accountType === 'teacher';
    setTab(isTeacher ? 'teacher' : 'student');
    if (isTeacher) setEmail(session.identifier);
    else           setUsername(session.identifier);
    // Don't auto-fill password — user must still type it for security
  }

  /* Sessions filtered by current tab */
  const tabSessions = savedSessions.filter(s => s.accountType === (tab === 'teacher' ? 'teacher' : 'student'));

  return (
    <PageShell>
      <LogoHeader />

      {/* Online/offline badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.75rem' }}>
        <span style={{
          fontSize: '.75rem', fontWeight: 700, padding: '.2rem .7rem',
          borderRadius: '999px',
          background: isOnline ? '#dcfce7' : '#1f2937',
          color:      isOnline ? '#166534' : '#f9fafb',
        }}>
          {isOnline ? '🟢 Online' : '📵 Offline'}
        </span>
        {!isOnline && (
          <span style={{ fontSize: '.75rem', color: '#5a8070' }}>
            Saved accounts can log in offline
          </span>
        )}
      </div>

      <p style={{ color: '#5a8070', fontSize: '.9rem', margin: '0 0 1.5rem', fontWeight: 500 }}>Offline Digital Attendance</p>

      {/* Role toggle */}
      <div style={{ display: 'flex', background: 'rgba(255,255,255,.5)', borderRadius: '50px', padding: '.25rem', width: '100%', marginBottom: '1.25rem', gap: '.25rem' }}>
        {[{ key: 'teacher', label: '👨‍🏫 Teacher' }, { key: 'student', label: '👨‍🎓 Student' }].map(t => (
          <button key={t.key} type="button" onClick={() => { setTab(t.key); setError(''); }}
            style={{ flex: 1, padding: '.5rem', border: 'none', borderRadius: '50px', cursor: 'pointer', fontWeight: 700, fontSize: '.85rem', fontFamily: 'Inter,sans-serif', transition: 'all .18s', background: tab === t.key ? '#3e6f5c' : 'transparent', color: tab === t.key ? '#fff' : '#5a8070', boxShadow: tab === t.key ? '0 2px 10px rgba(62,111,92,.35)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Saved account quick-select */}
      {tabSessions.length > 0 && (
        <div style={{ width: '100%', marginBottom: '1rem' }}>
          <div style={{ fontSize: '.75rem', color: '#5a8070', fontWeight: 600, marginBottom: '.4rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Saved accounts
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
            {tabSessions.map(s => (
              <button
                key={s.sessionKey}
                type="button"
                onClick={() => handleQuickLogin(s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '.75rem',
                  width: '100%', padding: '.6rem .9rem',
                  background: 'rgba(255,255,255,.7)', border: '1.5px solid rgba(62,111,92,.2)',
                  borderRadius: '12px', cursor: 'pointer', fontFamily: 'Inter,sans-serif',
                  textAlign: 'left', transition: 'background .12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.9)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.7)'}
              >
                {/* Avatar initial */}
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #3e6f5c, #449c72)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '.9rem', flexShrink: 0 }}>
                  {s.user?.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '.88rem', color: '#2a4a3a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.user?.name || s.identifier}</div>
                  <div style={{ fontSize: '.75rem', color: '#5a8070' }}>{s.identifier}</div>
                </div>
                <span style={{ fontSize: '.72rem', color: '#449c72', fontWeight: 700 }}>Use →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ width: '100%', background: '#fee2e2', color: '#991b1b', borderRadius: '12px', padding: '.7rem 1rem', fontSize: '.85rem', marginBottom: '.75rem', display: 'flex', alignItems: 'flex-start', gap: '.5rem' }}>
          <span style={{ flexShrink: 0 }}>⚠</span>
          <span style={{ whiteSpace: 'pre-line' }}>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        <div style={inputWrap}>
          <span style={iconStyle}>👤</span>
          {tab === 'teacher'
            ? <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required autoFocus style={inputStyle} />
            : <input type="text"  placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required autoFocus style={inputStyle} />
          }
        </div>
        <div style={inputWrap}>
          <span style={iconStyle}>🔒</span>
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
        </div>
        <button type="submit" disabled={loading} style={{ ...btnGreen, opacity: loading ? .7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Signing in…' : 'Login'}
        </button>
      </form>

      {/* Offline notice */}
      {!isOnline && (
        <div style={{ marginTop: '1rem', padding: '.75rem 1rem', background: 'rgba(31,41,55,.08)', borderRadius: '12px', fontSize: '.78rem', color: '#5a8070', width: '100%', textAlign: 'center', lineHeight: 1.5 }}>
          📵 You're offline. You can log in if you've signed in before on this device.
        </div>
      )}

      {/* Create account link — only shown when online */}
      {isOnline && (
        <p style={{ marginTop: '1rem', fontSize: '.875rem', color: '#5a8070', textAlign: 'center' }}>
          Don't have an account?{' '}
          <button type="button" onClick={onCreateAccount}
            style={{ background: 'none', border: 'none', color: '#3e6f5c', fontWeight: 700, fontSize: '.875rem', cursor: 'pointer', fontFamily: 'Inter,sans-serif', textDecoration: 'underline', padding: 0 }}>
            Create Student Account
          </button>
        </p>
      )}
    </PageShell>
  );
}

/* ══════════════════════════════════════
   SCREEN 2 — STEP 1: Verify Student ID
══════════════════════════════════════ */
function VerifyLRNScreen({ onBack, onVerified }) {
  const [studentId, setStudentId] = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  async function handleLookup(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const data = await lookupStudentById(studentId.trim());
      if (data.has_account) {
        setError('This student already has an account. Please log in instead.');
      } else {
        onVerified(studentId.trim(), data);
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <PageShell>
      <LogoHeader />
      <p style={{ color: '#5a8070', fontSize: '.9rem', margin: '.35rem 0 1.75rem', fontWeight: 500 }}>Create Student Account</p>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '1.5rem', width: '100%', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#3e6f5c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.85rem' }}>1</div>
        <div style={{ flex: 1, maxWidth: 60, height: 3, background: '#c8e6c9', borderRadius: 2 }} />
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,.5)', color: '#5a8070', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.85rem' }}>2</div>
      </div>

      <div style={{ width: '100%', background: 'rgba(255,255,255,.6)', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.25rem', fontSize: '.85rem', color: '#3e6f5c' }}>
        <div style={{ fontWeight: 700, marginBottom: '.4rem' }}>🪪 Step 1 of 2 — Verify your Student ID</div>
        <div style={{ color: '#5a8070' }}>Enter your Student ID to confirm you are enrolled. Your teacher must have added you first.</div>
      </div>

      <ErrorBox msg={error} />

      <form onSubmit={handleLookup} style={{ width: '100%' }}>
        <div style={inputWrap}>
          <span style={iconStyle}>🪪</span>
          <input
            type="text"
            placeholder="Enter your Student ID"
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
            required
            autoFocus
            style={inputStyle}
          />
        </div>
        <button type="submit" disabled={loading || studentId.length < 1}
          style={{ ...btnGreen, opacity: (loading || studentId.length < 1) ? .65 : 1, cursor: (loading || studentId.length < 1) ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Looking up…' : 'Verify Student ID →'}
        </button>
      </form>

      <button type="button" onClick={onBack} style={{ ...btnOutline, marginTop: '.75rem' }}>
        ← Back to Login
      </button>
    </PageShell>
  );
}

/* ══════════════════════════════════════
   SCREEN 3 — STEP 2: Set Username & Password
══════════════════════════════════════ */
function SetCredentialsScreen({ lrn, studentInfo, onBack, onSuccess }) {  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleRegister(e) {
    e.preventDefault(); setError('');
    if (password !== confirm) return setError('Passwords do not match.');
    if (password.length < 6)  return setError('Password must be at least 6 characters.');
    setLoading(true);
    try {
      await studentSelfRegister(lrn, username, password);
      onSuccess(username);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <PageShell>
      <LogoHeader />
      <p style={{ color: '#5a8070', fontSize: '.9rem', margin: '.35rem 0 1.25rem', fontWeight: 500 }}>Create Student Account</p>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '1.25rem', width: '100%', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#449c72', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.85rem' }}>✓</div>
        <div style={{ flex: 1, maxWidth: 60, height: 3, background: '#3e6f5c', borderRadius: 2 }} />
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#3e6f5c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.85rem' }}>2</div>
      </div>

      {/* Student preview card */}
      <div style={{ width: '100%', background: 'rgba(255,255,255,.75)', borderRadius: '16px', padding: '1rem 1.25rem', marginBottom: '1.1rem', border: '2px solid #449c72' }}>
        <div style={{ fontWeight: 800, color: '#2a4a3a', fontSize: '1rem', marginBottom: '.5rem' }}>✅ Student Found</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.3rem .75rem', fontSize: '.82rem', color: '#3e6f5c' }}>
          <div><span style={{ color: '#5a8070' }}>Name:</span> <strong>{studentInfo.name}</strong></div>
          <div><span style={{ color: '#5a8070' }}>ID:</span> <strong>{studentInfo.student_id}</strong></div>
          {studentInfo.grade_level && <div><span style={{ color: '#5a8070' }}>Grade:</span> <strong>{studentInfo.grade_level}</strong></div>}
          {studentInfo.section     && <div><span style={{ color: '#5a8070' }}>Section:</span> <strong>{studentInfo.section}</strong></div>}
          {studentInfo.student_code && <div><span style={{ color: '#5a8070' }}>Strand:</span> <strong>{studentInfo.student_code}</strong></div>}
          {studentInfo.class_name  && <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#5a8070' }}>Class:</span> <strong>{studentInfo.class_name}</strong></div>}
        </div>
      </div>

      <ErrorBox msg={error} />

      <form onSubmit={handleRegister} style={{ width: '100%' }}>
        <div style={inputWrap}>
          <span style={iconStyle}>👤</span>
          <input type="text" placeholder="Choose a username" value={username}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
            required minLength={3} maxLength={30} autoFocus style={inputStyle} />
        </div>
        {username && (
          <div style={{ fontSize: '.78rem', color: '#5a8070', marginTop: '-.7rem', marginBottom: '.75rem', paddingLeft: '1.1rem' }}>
            Username: <strong style={{ color: '#3e6f5c' }}>{username}</strong>
          </div>
        )}
        <div style={inputWrap}>
          <span style={iconStyle}>🔒</span>
          <input type="password" placeholder="Create a password (min 6 chars)" value={password}
            onChange={e => setPassword(e.target.value)} required style={inputStyle} />
        </div>
        <div style={inputWrap}>
          <span style={iconStyle}>🔒</span>
          <input type="password" placeholder="Confirm your password" value={confirm}
            onChange={e => setConfirm(e.target.value)} required style={{ ...inputStyle, borderBottom: confirm && confirm !== password ? '2px solid #ef4444' : 'none' }} />
        </div>
        {confirm && confirm !== password && (
          <div style={{ fontSize: '.78rem', color: '#ef4444', marginTop: '-.7rem', marginBottom: '.75rem', paddingLeft: '1.1rem' }}>Passwords don't match</div>
        )}
        <button type="submit" disabled={loading || !username || !password || password !== confirm}
          style={{ ...btnGreen, opacity: (loading || !username || !password || password !== confirm) ? .65 : 1, cursor: (loading || !username || !password || password !== confirm) ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <button type="button" onClick={onBack} style={{ ...btnOutline, marginTop: '.75rem' }}>← Back</button>
    </PageShell>
  );
}

/* ══════════════════════════════════════
   SCREEN 4 — SUCCESS
══════════════════════════════════════ */
function SuccessScreen({ username, onLogin }) {
  return (
    <PageShell>
      <div style={{ textAlign: 'center', width: '100%' }}>
        <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🎉</div>
        <h2 style={{ fontWeight: 800, fontSize: '1.5rem', color: '#2a4a3a', marginBottom: '.5rem' }}>Account Created!</h2>
        <p style={{ color: '#5a8070', fontSize: '.95rem', marginBottom: '2rem' }}>
          Your account <strong style={{ color: '#3e6f5c' }}>{username}</strong> is ready. You can now log in.
        </p>
        <button type="button" onClick={onLogin} style={btnGreen}>
          Go to Login →
        </button>
      </div>
    </PageShell>
  );
}

/* ══════════════════════════════════════
   ROOT — controls which screen is shown
══════════════════════════════════════ */
export default function LoginPage() {
  const [screen, setScreen]           = useState('login');
  const [verifiedId, setVerifiedId]   = useState('');
  const [studentInfo, setStudentInfo] = useState(null);
  const [createdUsername, setCreated] = useState('');

  if (screen === 'verify') {
    return (
      <VerifyLRNScreen
        onBack={() => setScreen('login')}
        onVerified={(id, info) => { setVerifiedId(id); setStudentInfo(info); setScreen('credentials'); }}
      />
    );
  }

  if (screen === 'credentials') {
    return (
      <SetCredentialsScreen
        lrn={verifiedId}
        studentInfo={studentInfo}
        onBack={() => setScreen('verify')}
        onSuccess={(uname) => { setCreated(uname); setScreen('success'); }}
      />
    );
  }

  if (screen === 'success') {
    return <SuccessScreen username={createdUsername} onLogin={() => setScreen('login')} />;
  }

  return <LoginScreen onCreateAccount={() => setScreen('verify')} />;
}
