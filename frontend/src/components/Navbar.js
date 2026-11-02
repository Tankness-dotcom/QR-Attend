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

export default function Navbar() {
  const { user, logout, isTeacher, isStudent, isAdmin } = useAuth();
  const navigate   = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef    = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [open]);

  // Close menu on navigation
  function go(path) { setOpen(false); navigate(path); }

  if (!user) return null;

  const profilePath = isStudent ? '/student/portal' : '/profile';

  const teacherLinks = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/scanner',   label: '📷 Scan'   },
    { to: '/students',  label: 'Students'  },
    ...(isAdmin ? [{ to: '/teachers', label: 'Teachers' }] : []),
  ];
  const studentLinks = [{ to: '/student/portal', label: 'My Attendance' }];
  const links = isTeacher ? teacherLinks : studentLinks;

  return (
    <>
      <nav className="navbar" ref={menuRef}>
        {/* Brand */}
        <div className="navbar-brand" onClick={() => go(isStudent ? '/student/portal' : '/dashboard')} style={{ cursor: 'pointer' }}>
          <img src="/qrattend-logo.png" alt="QR-Attend" />
          <div>
            <span className="brand-text">QR-Attend</span>
            <span className="brand-sub hide-mobile">Attendance Management System</span>
          </div>
        </div>

        {/* Desktop links */}
        <div className="navbar-links hide-mobile-nav">
          {links.map(l => (
            <NavLink key={l.to} to={l.to}>{l.label}</NavLink>
          ))}
          <div
            onClick={() => go(profilePath)}
            style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer', marginLeft: '.25rem' }}
          >
            <NavAvatar user={user} size={30} />
            <span className="navbar-user hide-mobile"
              style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

        {/* Mobile: avatar + hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }} className="show-mobile-nav">
          <div onClick={() => go(profilePath)} style={{ cursor: 'pointer' }}>
            <NavAvatar user={user} size={32} />
          </div>
          <button
            onClick={() => setOpen(o => !o)}
            aria-label="Menu"
            style={{
              background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.3)',
              borderRadius: '7px', width: 36, height: 36, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer', padding: 0,
            }}
          >
            {[0,1,2].map(i => (
              <span key={i} style={{ width: 18, height: 2, background: '#fff', borderRadius: 2, display: 'block',
                transition: 'transform .2s, opacity .2s',
                transform: open
                  ? i === 0 ? 'rotate(45deg) translate(4px,4px)' : i === 2 ? 'rotate(-45deg) translate(4px,-4px)' : 'none'
                  : 'none',
                opacity: open && i === 1 ? 0 : 1,
              }} />
            ))}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {open && (
        <div style={{
          position: 'fixed', top: 52, left: 0, right: 0, zIndex: 99,
          background: '#3e6f5c',
          boxShadow: '0 8px 24px rgba(0,0,0,.25)',
          padding: '.5rem',
          display: 'none', // overridden below
        }} className="mobile-menu">
          {links.map(l => (
            <button key={l.to} onClick={() => go(l.to)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '.85rem 1rem', background: 'none', border: 'none', color: '#fff', fontSize: '.95rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', cursor: 'pointer', borderRadius: '8px' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              {l.label}
            </button>
          ))}
          <div style={{ height: '1px', background: 'rgba(255,255,255,.15)', margin: '.35rem 0' }} />
          <button onClick={() => go(profilePath)}
            style={{ display: 'flex', alignItems: 'center', gap: '.6rem', width: '100%', textAlign: 'left', padding: '.85rem 1rem', background: 'none', border: 'none', color: '#fff', fontSize: '.95rem', fontFamily: 'Inter,sans-serif', cursor: 'pointer', borderRadius: '8px' }}>
            <NavAvatar user={user} size={28} />
            <span style={{ fontWeight: 600 }}>{user.name}</span>
            {isAdmin   && <span style={{ fontSize: '.65rem', background: 'rgba(255,255,255,.2)', padding: '.1rem .4rem', borderRadius: '4px' }}>ADMIN</span>}
            {isStudent && <span style={{ fontSize: '.65rem', background: 'rgba(255,255,255,.2)', padding: '.1rem .4rem', borderRadius: '4px' }}>STUDENT</span>}
          </button>
          <button onClick={() => { setOpen(false); logout(); navigate('/login'); }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '.85rem 1rem', background: 'rgba(220,38,38,.15)', border: 'none', color: '#fca5a5', fontSize: '.95rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', cursor: 'pointer', borderRadius: '8px', marginTop: '.35rem' }}>
            🚪 Logout
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .hide-mobile-nav { display: none !important; }
          .show-mobile-nav { display: flex !important; }
          .mobile-menu     { display: block !important; }
        }
        @media (min-width: 641px) {
          .hide-mobile-nav { display: flex !important; }
          .show-mobile-nav { display: none  !important; }
        }
      `}</style>
    </>
  );
}
