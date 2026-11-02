const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`
  };
}

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ── Auth ── */
export const teacherLogin = (email, password) =>
  fetch(`${BASE}/auth/teacher/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; });

export const studentLogin = (username, password) =>
  fetch(`${BASE}/auth/student/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
    .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; });

export const getTeacherMe = () => request('GET', '/auth/teacher/me');
export const getStudentMe = () => request('GET', '/auth/student/me');

/* ── Teacher profile ── */
export const uploadTeacherPhoto  = (photo)          => request('PUT',    '/auth/teacher/photo',    { photo });
export const removeTeacherPhoto  = ()               => request('DELETE', '/auth/teacher/photo');
export const changeTeacherPassword = (current_password, new_password) =>
  request('PUT', '/auth/teacher/password', { current_password, new_password });

/* ── Student profile ── */
export const uploadStudentPhoto    = (photo)                        => request('PUT',    '/auth/student/photo',         { photo });
export const removeStudentPhoto    = ()                             => request('DELETE', '/auth/student/photo');
export const changeStudentPassword = (current_password, new_password) => request('PUT', '/auth/student/password', { current_password, new_password });
export const lookupStudentByLRN    = (lrn)                          => request('GET',    `/auth/student/lookup-lrn?lrn=${encodeURIComponent(lrn)}`);
export const studentSelfRegister   = (lrn, username, password)      => request('POST',   '/auth/student/self-register', { lrn, username, password });

/* ── Teacher management (admin) ── */
export const getTeachers     = ()     => request('GET',    '/auth/teachers');
export const registerTeacher = (data) => request('POST',   '/auth/teacher/register', data);
export const deleteTeacher   = (id)   => request('DELETE', `/auth/teachers/${id}`);

/* ── Student accounts ── */
export const createStudentAccount = (student_id, username, password) =>
  request('POST', '/auth/student/create', { student_id, username, password });

/* ── Classes ── */
export const getClasses  = ()           => request('GET',    '/classes');
export const createClass = (name, subj) => request('POST',   '/classes', { name, subject: subj });
export const deleteClass = (id)         => request('DELETE', `/classes/${id}`);

/* ── Students ── */
export const getStudents      = (class_id) => request('GET', `/students${class_id ? `?class_id=${class_id}` : ''}`);
export const addStudent       = (data)     => request('POST',   '/students',       data);
export const bulkAddStudents  = (class_id, students) => request('POST', '/students/bulk', { class_id, students });
export const deleteStudent    = (id)       => request('DELETE', `/students/${id}`);
export const getStudentQR     = (id)       => request('GET',    `/students/${id}/qr`);

/* ── Student self-service ── */
export const getMyStudentInfo = () => request('GET', '/students/me');
export const getMyStudentQR   = () => request('GET', '/students/me/qr');

/* ── Attendance ── */
export const scanQR = (qr_token, class_id) =>
  fetch(`${BASE}/attendance/scan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qr_token, class_id }) })
    .then(r => r.json());

export const getAttendance        = (params = {}) => { const qs = new URLSearchParams(params).toString(); return request('GET', `/attendance${qs ? '?' + qs : ''}`); };
export const getAttendanceSummary = (class_id)    => request('GET', `/attendance/summary?class_id=${class_id}`);
export const getAttendanceDates   = (class_id)    => request('GET', `/attendance/dates?class_id=${class_id}`);
export const getAttendanceToday   = (class_id)    => request('GET', `/attendance/today?class_id=${class_id}`);
export const markAttendanceManual = (data)         => request('POST',   '/attendance/manual', data);
export const deleteAttendance     = (id)           => request('DELETE', `/attendance/${id}`);
