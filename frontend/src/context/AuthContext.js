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
    try {
      const fn   = accountType === 'student' ? getStudentMe : getTeacherMe;
      const data = await fn();
      setUser(data.user);
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('accountType');
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
    } catch {}
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('accountType', userData.accountType);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('accountType');
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
