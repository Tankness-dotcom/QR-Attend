# 📷 Class Scanner — QR Attendance System

A full-stack web application for tracking student attendance via unique QR codes.
Works on both **mobile** and **PC** (any device with a camera and browser).

---

## Features

- 🔐 Teacher login with JWT authentication
- 🏫 Manage multiple classes
- 👨‍🎓 Add students individually or bulk-import via CSV
- 🔲 Each student gets a unique QR code (view, download, print)
- 📱 QR scanner works on mobile & desktop browsers (uses device camera)
- 📊 Attendance dashboard with per-student rates
- 📅 Filter records by date
- ⬇️ Export attendance data as CSV

---

## Quick Start

### 1. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Start the backend

```bash
cd backend
npm start
# Runs on http://localhost:5000
```

### 3. Start the frontend (development)

```bash
cd frontend
npm start
# Runs on http://localhost:3000  (proxies API to :5000)
```

### 4. Open the app

Navigate to **http://localhost:3000**

Default teacher credentials:
- Email: `admin@school.com`
- Password: `admin123`

---

## How to Use

1. **Login** as a teacher
2. **Create a class** from the Dashboard
3. **Add students** (Students page) — individually or bulk CSV format: `Name, StudentID, Email`
4. **View QR codes** — click "View QR" next to any student to see, download or print their QR
5. **Scan attendance** — go to the Scan page, select the class, start the camera, scan student QR codes
6. **View attendance** — Dashboard shows summary (% rates) and full records per class

---

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Backend  | Node.js, Express, better-sqlite3 |
| Auth     | JWT (jsonwebtoken), bcryptjs |
| QR Gen   | qrcode (server-side PNG generation) |
| Frontend | React 18, React Router v6 |
| QR Scan  | html5-qrcode (camera API) |
| Database | SQLite (single file, zero config) |

---

## Project Structure

```
Class Scanner/
├── backend/
│   ├── src/
│   │   ├── server.js          # Express entry point
│   │   ├── database.js        # SQLite schema + seed
│   │   ├── middleware/auth.js # JWT middleware
│   │   └── routes/
│   │       ├── auth.js
│   │       ├── classes.js
│   │       ├── students.js
│   │       └── attendance.js
│   └── package.json
└── frontend/
    ├── public/index.html
    ├── src/
    │   ├── App.js
    │   ├── api.js             # API client
    │   ├── index.css          # Global styles
    │   ├── context/AuthContext.js
    │   ├── components/
    │   │   ├── Navbar.js
    │   │   ├── ProtectedRoute.js
    │   │   └── QRCodeDisplay.js
    │   └── pages/
    │       ├── LoginPage.js
    │       ├── DashboardPage.js
    │       ├── StudentsPage.js
    │       └── ScannerPage.js
    └── package.json
```

---

## Mobile Access

To access the scanner from a phone on the same network:

1. Find your PC's local IP: `ipconfig` (Windows)
2. Start both backend and frontend
3. On your phone, open: `http://<your-pc-ip>:3000`

> **Note:** Camera access requires HTTPS in production. For local dev, Chrome on Android allows camera on local network IPs.
