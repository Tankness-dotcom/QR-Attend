import { offlineGet, offlineScanQR } from './offline/offlineApi';
import { offlineTeacherLogin, offlineStudentLogin } from './offline/offlineAuth';

const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ── Auth — offline-aware login, always-online for everything else ── */
export const teacherLogin = (email, password)    => offlineTeacherLogin(email, password);
export const studentLogin = (username, password) => offlineStudentLogin(username, password);

export const getTeacherMe = () => request('GET', '/auth/teacher/me');
export const getStudentMe = () => request('GET', '/auth/student/me');

/* ── Teacher profile ── */
export const uploadTeacherPhoto    = (photo) => request('PUT',    '/auth/teacher/photo',    { photo });
export const removeTeacherPhoto    = ()      => request('DELETE', '/auth/teacher/photo');
export const changeTeacherPassword = (current_password, new_password) =>
  request('PUT', '/auth/teacher/password', { current_password, new_password });

/* ── Student profile ── */
export const uploadStudentPhoto    = (photo) => request('PUT',    '/auth/student/photo',    { photo });
export const removeStudentPhoto    = ()      => request('DELETE', '/auth/student/photo');
export const changeStudentPassword = (current_password, new_password) =>
  request('PUT', '/auth/student/password', { current_password, new_password });
export const lookupStudentById     = (student_id) =>
  request('GET', `/auth/student/lookup-id?student_id=${encodeURIComponent(student_id)}`);
export const studentSelfRegister   = (student_id, username, password) =>
  request('POST', '/auth/student/self-register', { student_id, username, password });

/* ── Teacher management ── */
export const getTeachers     = ()     => request('GET',    '/auth/teachers');
export const registerTeacher = (data) => request('POST',   '/auth/teacher/register', data);
export const deleteTeacher   = (id)   => request('DELETE', `/auth/teachers/${id}`);

/* ── Student accounts ── */
export const createStudentAccount = (student_id, username, password) =>
  request('POST', '/auth/student/create', { student_id, username, password });

/* ── Classes — offline-aware reads ── */
export const getClasses  = ()           => offlineGet('/classes');
export const createClass = (name, subj) => request('POST',   '/classes', { name, subject: subj });
export const deleteClass = (id)         => request('DELETE', `/classes/${id}`);

/* ── Students — offline-aware reads ── */
export const getStudents     = (class_id) =>
  offlineGet(`/students${class_id ? `?class_id=${class_id}` : ''}`);
export const addStudent      = (data)     => request('POST',   '/students',      data);
export const bulkAddStudents = (class_id, students) =>
  request('POST', '/students/bulk', { class_id, students });
export const deleteStudent   = (id)       => request('DELETE', `/students/${id}`);
export const getStudentQR    = (id)       => request('GET',    `/students/${id}/qr`);

/* ── Student self-service — offline-aware reads ── */
export const getMyStudentInfo = () => offlineGet('/students/me');
export const getMyStudentQR   = () => request('GET', '/students/me/qr');

/* ── Attendance — offline-aware reads + offline scan ── */
export const scanQR = (qr_token, class_id) => offlineScanQR(qr_token, class_id);

export const getAttendance = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return offlineGet(`/attendance${qs ? '?' + qs : ''}`);
};
export const getAttendanceSummary = (class_id) =>
  offlineGet(`/attendance/summary?class_id=${class_id}`);
export const getAttendanceDates   = (class_id) =>
  offlineGet(`/attendance/dates?class_id=${class_id}`);
export const getAttendanceToday   = (class_id) =>
  offlineGet(`/attendance/today?class_id=${class_id}`);
export const markAttendanceManual = (data) =>
  request('POST',   '/attendance/manual', data);
export const deleteAttendance     = (id)  =>
  request('DELETE', `/attendance/${id}`);
