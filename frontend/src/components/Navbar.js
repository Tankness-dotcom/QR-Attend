import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function NavAvatar({ user, size = 32 }) {
  const initials = (user?.name || '?')
    .split(' ').filter(Boolean).slice(0, 2)
    .map(w => w[0].toUpperCase()).join('');
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: user?.photo ? 'transparent' : 'rgba(255,255,255,.25)',
      border: '2px solid rgba(255,255,255,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', flexShrink: 0,
      fontSize: Math.round(size * 0.36), fontWeight: 700, color: '#fff',
    }}>
      {user?.photo
        ? <img src={user.photo} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials}
    </div>
  );
}

/* ── inline styles for hamburger bars ── */
const barBase = { width: 18, height: 2, background: '#fff', borderRadius: 2, display: 'block', transition: 'transform .2s, opacity .2s' };

export default function Navbar() {
  const { user, logout, isTeacher, isStudent, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);
  const menuRef = useRef(null);

  /* track screen width */
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  function go(path) { setOpen(false); navigate(path); }

  if (!user) return null;

  const profilePath = isStudent ? '/student/portal' : '/profile';

  const links = isTeacher ? [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/scanner',   label: '📷 Scan'   },
    { to: '/students',  label: 'Students'  },
    ...(isAdmin ? [{ to: '/teachers', label: 'Teachers' }] : []),
  ] : [
    { to: '/student/portal', label: 'My Attendance' },
  ];

  /* ── shared dropdown item style ── */
  const dropItem = {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '.85rem 1.1rem', background: 'none', border: 'none',
    color: '#fff', fontSize: '.95rem', fontWeight: 600,
    fontFamily: 'Inter,sans-serif', cursor: 'pointer',
    borderRadius: '8px', transition: 'background .12s',
  };

  return (
    <>
      <nav className="navbar" ref={menuRef}>

        {/* Brand */}
        <div
          className="navbar-brand"
          onClick={() => go(isStudent ? '/student/portal' : '/dashboard')}
          style={{ cursor: 'pointer' }}
        >
          <img src="/qrattend-logo.png" alt="QR-Attend" />
          <div>
            <span style={{ whiteSpace: 'nowrap' }}>QR-Attend</span>
            {!isMobile && (
              <span className="brand-sub">Attendance Management System</span>
            )}
          </div>
        </div>

        {/* ── DESKTOP nav links ── */}
        {!isMobile && (
          <div className="navbar-links">
            {links.map(l => (
              <NavLink key={l.to} to={l.to}>{l.label}</NavLink>
            ))}
            <div
              onClick={() => go(profilePath)}
              style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer', marginLeft: '.25rem' }}
            >
              <NavAvatar user={user} size={30} />
              <span
                className="navbar-user"
                style={{ maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {user.name}
                {isAdmin   && <span style={{ marginLeft: '.3rem', fontSize: '.6rem', background: 'rgba(255,255,255,.2)', padding: '.05rem .35rem', borderRadius: '4px' }}>ADMIN</span>}
                {isStudent && <span style={{ marginLeft: '.3rem', fontSize: '.6rem', background: 'rgba(255,255,255,.2)', padding: '.05rem .35rem', borderRadius: '4px' }}>STUDENT</span>}
              </span>
            </div>
            <button
              className="btn btn-sm"
              style={{ background: 'rgba(255,255,255,.18)', color: '#fff', border: '1px solid rgba(255,255,255,.3)', marginLeft: '.25rem' }}
              onClick={() => { logout(); navigate('/login'); }}
            >
              Logout
            </button>
          </div>
        )}

        {/* ── MOBILE: avatar + hamburger ── */}
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '.45rem' }}>
            <div onClick={() => go(profilePath)} style={{ cursor: 'pointer' }}>
              <NavAvatar user={user} size={32} />
            </div>
            <button
              onClick={() => setOpen(o => !o)}
              aria-label={open ? 'Close menu' : 'Open menu'}
              style={{
                background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.3)',
                borderRadius: '7px', width: 38, height: 38, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'pointer', padding: 0,
              }}
            >
              <span style={{ ...barBase, transform: open ? 'rotate(45deg) translate(0, 7px)' : 'none' }} />
              <span style={{ ...barBase, opacity: open ? 0 : 1 }} />
              <span style={{ ...barBase, transform: open ? 'rotate(-45deg) translate(0, -7px)' : 'none' }} />
            </button>
          </div>
        )}
      </nav>

      {/* ── MOBILE dropdown — rendered outside nav so no ref conflict ── */}
      {isMobile && open && (
        <div style={{
          position: 'fixed',
          top: 52,
          left: 0,
          right: 0,
          zIndex: 200,
          background: '#3e6f5c',
          boxShadow: '0 8px 24px rgba(0,0,0,.3)',
          padding: '.5rem .5rem .75rem',
        }}>
          {links.map(l => (
            <button
              key={l.to}
              onClick={() => go(l.to)}
              style={dropItem}
              onTouchStart={e => e.currentTarget.style.background = 'rgba(255,255,255,.12)'}
              onTouchEnd={e  => e.currentTarget.style.background = 'none'}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              {l.label}
            </button>
          ))}

          <div style={{ height: '1px', background: 'rgba(255,255,255,.18)', margin: '.4rem 0' }} />

          {/* Profile row */}
          <button
            onClick={() => go(profilePath)}
            style={{ ...dropItem, display: 'flex', alignItems: 'center', gap: '.65rem' }}
            onTouchStart={e => e.currentTarget.style.background = 'rgba(255,255,255,.12)'}
            onTouchEnd={e  => e.currentTarget.style.background = 'none'}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <NavAvatar user={user} size={30} />
            <span>{user.name}</span>
            {isAdmin   && <span style={{ fontSize: '.65rem', background: 'rgba(255,255,255,.2)', padding: '.1rem .4rem', borderRadius: '4px' }}>ADMIN</span>}
            {isStudent && <span style={{ fontSize: '.65rem', background: 'rgba(255,255,255,.2)', padding: '.1rem .4rem', borderRadius: '4px' }}>STUDENT</span>}
          </button>

          {/* Logout */}
          <button
            onClick={() => { setOpen(false); logout(); navigate('/login'); }}
            style={{ ...dropItem, background: 'rgba(220,38,38,.18)', color: '#fca5a5', marginTop: '.25rem' }}
          >
            🚪 Logout
          </button>
        </div>
      )}
    </>
  );
}
