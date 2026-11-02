import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

import LoginPage        from './pages/LoginPage';
import DashboardPage    from './pages/DashboardPage';
import StudentsPage     from './pages/StudentsPage';
import ScannerPage      from './pages/ScannerPage';
import TeachersPage     from './pages/TeachersPage';
import StudentPortalPage from './pages/StudentPortalPage';
import ProfilePage      from './pages/ProfilePage';

function Layout({ children }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
    </>
  );
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.accountType === 'student' ? '/student/portal' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Teacher routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute require="teacher">
              <Layout><DashboardPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/scanner" element={
            <ProtectedRoute require="teacher">
              <Layout><ScannerPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/students" element={
            <ProtectedRoute require="teacher">
              <Layout><StudentsPage /></Layout>
            </ProtectedRoute>
          } />

          {/* Admin only */}
          <Route path="/teachers" element={
            <ProtectedRoute require="admin">
              <Layout><TeachersPage /></Layout>
            </ProtectedRoute>
          } />

          {/* Teacher/Admin profile */}
          <Route path="/profile" element={
            <ProtectedRoute require="teacher">
              <Layout><ProfilePage /></Layout>
            </ProtectedRoute>
          } />

          {/* Student route */}
          <Route path="/student/portal" element={
            <ProtectedRoute require="student">
              <Layout><StudentPortalPage /></Layout>
            </ProtectedRoute>
          } />

          {/* Root redirect */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
