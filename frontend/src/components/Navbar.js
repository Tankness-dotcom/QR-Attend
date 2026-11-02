import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function NavAvatar({ user, size = 34 }) {
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
      cursor: 'pointer',
    }}>
      {user?.photo
        ? <img src={user.photo} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials
      }
    </div>
  );
}

export default function Navbar() {
  const { user, logout, isTeacher, isStudent, isAdmin } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const profilePath = isStudent ? '/student/portal' : '/profile';

  return (
    <nav className="navbar">
      {/* Brand */}
      <div className="navbar-brand">
        <img src="/qrattend-logo.png" alt="QR-Attend Logo" />
        <div>
          <span>QR-Attend</span>
          <span className="brand-sub">Attendance Management System</span>
        </div>
      </div>

      {/* Links */}
      <div className="navbar-links">
        {isTeacher && (
          <>
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/scanner">📷 Scan</NavLink>
            <NavLink to="/students">Students</NavLink>
            {isAdmin && <NavLink to="/teachers">Teachers</NavLink>}
          </>
        )}
        {isStudent && (
          <NavLink to="/student/portal">My Attendance</NavLink>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginLeft: '.5rem' }}>
          {/* Avatar — clickable, goes to profile */}
          <div
            onClick={() => navigate(profilePath)}
            title="My Profile"
            style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer' }}
          >
            <NavAvatar user={user} />
            <span className="navbar-user hide-mobile">
              {user.name}
              {isAdmin   && <span style={{ marginLeft: '.35rem', fontSize: '.65rem', background: 'rgba(255,255,255,.2)', padding: '.1rem .4rem', borderRadius: '4px' }}>ADMIN</span>}
              {isStudent && <span style={{ marginLeft: '.35rem', fontSize: '.65rem', background: 'rgba(255,255,255,.2)', padding: '.1rem .4rem', borderRadius: '4px' }}>STUDENT</span>}
            </span>
          </div>

          <button
            className="btn btn-sm"
            style={{ background: 'rgba(255,255,255,.18)', color: '#fff', border: '1px solid rgba(255,255,255,.3)' }}
            onClick={() => { logout(); navigate('/login'); }}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
