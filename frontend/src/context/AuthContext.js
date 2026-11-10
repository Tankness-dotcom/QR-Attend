import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getTeacherMe, getStudentMe } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  const verify = useCallback(async () => {
    const token       = localStorage.getItem('token');
    const accountType = localStorage.getItem('accountType');
    if (!token) { setLoading(false); return; }

    // If we have a cached user object (set by offline login), use it directly
    // and skip the network call which would fail offline
    const cachedUser = localStorage.getItem('cachedUser');
    if (!navigator.onLine && cachedUser) {
      try {
        setUser(JSON.parse(cachedUser));
        setLoading(false);
        return;
      } catch {}
    }

    try {
      const fn   = accountType === 'student' ? getStudentMe : getTeacherMe;
      const data = await fn();
      setUser(data.user);
      // Keep cachedUser up to date for offline use
      localStorage.setItem('cachedUser', JSON.stringify(data.user));
    } catch {
      // If offline and we have a cached user, use it
      if (cachedUser) {
        try { setUser(JSON.parse(cachedUser)); setLoading(false); return; }
        catch {}
      }
      localStorage.removeItem('token');
      localStorage.removeItem('accountType');
      localStorage.removeItem('cachedUser');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { verify(); }, [verify]);

  /** Call after any photo/profile update to pull fresh data from server */
  const refreshUser = useCallback(async () => {
    const accountType = localStorage.getItem('accountType');
    const fn = accountType === 'student' ? getStudentMe : getTeacherMe;
    try {
      const data = await fn();
      setUser(data.user);
      localStorage.setItem('cachedUser', JSON.stringify(data.user));
    } catch {}
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('accountType', userData.accountType);
    localStorage.setItem('cachedUser', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('accountType');
    localStorage.removeItem('cachedUser');
    setUser(null);
  };

  /** Optimistically update a single field in user state (e.g. photo) */
  const patchUser = (patch) => setUser(prev => prev ? { ...prev, ...patch } : prev);

  const isTeacher = user?.accountType === 'teacher';
  const isStudent = user?.accountType === 'student';
  const isAdmin   = user?.accountType === 'teacher' && user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, patchUser, isTeacher, isStudent, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
