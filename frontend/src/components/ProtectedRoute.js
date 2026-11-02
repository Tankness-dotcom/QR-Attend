import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Props:
 *   require: 'teacher' | 'student' | 'admin' | undefined (any authenticated user)
 */
export default function ProtectedRoute({ children, require: requireRole }) {
  const { user, loading, isTeacher, isStudent, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="center" style={{ minHeight: '80vh' }}>
        <div className="spinner" />
        <p className="text-muted mt-2">Loading…</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (requireRole === 'teacher' && !isTeacher) return <Navigate to="/student/portal" replace />;
  if (requireRole === 'admin'   && !isAdmin)   return <Navigate to="/dashboard" replace />;
  if (requireRole === 'student' && !isStudent) return <Navigate to="/dashboard" replace />;

  return children;
}
