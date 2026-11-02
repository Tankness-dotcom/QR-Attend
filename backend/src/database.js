const bcrypt = require('bcryptjs');

/*
  Database layer — Turso (libsql) hosted SQLite
  ─────────────────────────────────────────────
  Falls back to a local file-based SQLite when TURSO_URL is not set,
  which lets local development keep working without any Turso account.

  Environment variables (required on Render / production):
    TURSO_URL    — e.g. libsql://your-db.turso.io
    TURSO_TOKEN  — auth token from Turso dashboard
*/

let client = null;

async function initDb() {
  if (client) return;

  const { createClient } = require('@libsql/client');

  const url   = process.env.TURSO_URL;
  const token = process.env.TURSO_TOKEN;

  if (url && token) {
    // ── Production: Turso remote database ──
    client = createClient({ url, authToken: token });
    console.log('🌐 Connected to Turso remote database');
  } else {
    // ── Development: local SQLite file ──
    const path = require('path');
    const localPath = 'file:' + path.join(__dirname, '..', 'attendance.db');
    client = createClient({ url: localPath });
    console.log('💾 Using local SQLite database (dev mode)');
  }

  await initSchema();
}

async function initSchema() {
  // Use execute for each statement individually (libsql doesn't support multi-statement strings)
  const statements = [
    `CREATE TABLE IF NOT EXISTS teachers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      email      TEXT    NOT NULL UNIQUE,
      password   TEXT    NOT NULL,
      role       TEXT    NOT NULL DEFAULT 'teacher',
      photo      TEXT,
      created_at TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS classes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      name       TEXT    NOT NULL,
      subject    TEXT,
      created_at TEXT    DEFAULT (datetime('now')),
      FOREIGN KEY (teacher_id) REFERENCES teachers(id)
    )`,
    `CREATE TABLE IF NOT EXISTS students (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id     INTEGER NOT NULL,
      name         TEXT    NOT NULL,
      student_id   TEXT    NOT NULL UNIQUE,
      email        TEXT,
      phone        TEXT,
      lrn          TEXT,
      grade_level  TEXT,
      section      TEXT,
      student_code TEXT,
      photo        TEXT,
      qr_token     TEXT    NOT NULL UNIQUE,
      created_at   TEXT    DEFAULT (datetime('now')),
      FOREIGN KEY (class_id) REFERENCES classes(id)
    )`,
    `CREATE TABLE IF NOT EXISTS student_accounts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id  INTEGER NOT NULL UNIQUE,
      username    TEXT    NOT NULL UNIQUE,
      password    TEXT    NOT NULL,
      created_at  TEXT    DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id)
    )`,
    `CREATE TABLE IF NOT EXISTS attendance (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id  INTEGER NOT NULL,
      class_id    INTEGER NOT NULL,
      scanned_at  TEXT    DEFAULT (datetime('now')),
      date        TEXT    NOT NULL,
      status      TEXT    DEFAULT 'present',
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (class_id)   REFERENCES classes(id)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique
      ON attendance(student_id, class_id, date)`,
  ];

  for (const sql of statements) {
    await client.execute(sql);
  }

  // Safe migrations for existing databases
  const migrations = [
    "ALTER TABLE teachers ADD COLUMN role TEXT NOT NULL DEFAULT 'teacher'",
    "ALTER TABLE teachers ADD COLUMN photo TEXT",
    "ALTER TABLE students ADD COLUMN phone TEXT",
    "ALTER TABLE students ADD COLUMN lrn TEXT",
    "ALTER TABLE students ADD COLUMN grade_level TEXT",
    "ALTER TABLE students ADD COLUMN section TEXT",
    "ALTER TABLE students ADD COLUMN student_code TEXT",
    "ALTER TABLE students ADD COLUMN photo TEXT",
  ];
  for (const sql of migrations) {
    try { await client.execute(sql); } catch { /* column already exists — ignore */ }
  }

  // Seed default admin if none exists
  const result = await client.execute("SELECT id FROM teachers WHERE role = 'admin' LIMIT 1");
  if (result.rows.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await client.execute({
      sql: 'INSERT INTO teachers (name, email, password, role) VALUES (?, ?, ?, ?)',
      args: ['Admin', 'admin@rnhs.edu.ph', hash, 'admin']
    });
    console.log('✅ Default admin created: admin@rnhs.edu.ph / admin123');
  }
}

/* ══════════════════════════════════════
   Query helpers  (all async)
══════════════════════════════════════ */

/**
 * run — execute a statement, return nothing
 */
async function run(sql, params = []) {
  await client.execute({ sql, args: params });
}

/**
 * get — return the first matching row as a plain object, or undefined
 */
async function get(sql, params = []) {
  const result = await client.execute({ sql, args: params });
  if (result.rows.length === 0) return undefined;
  return rowToObject(result.columns, result.rows[0]);
}

/**
 * all — return all matching rows as plain objects
 */
async function all(sql, params = []) {
  const result = await client.execute({ sql, args: params });
  return result.rows.map(row => rowToObject(result.columns, row));
}

/**
 * insert — execute an INSERT and return the new row's integer id
 */
async function insert(sql, params = []) {
  const result = await client.execute({ sql, args: params });
  return Number(result.lastInsertRowid);
}

/**
 * Convert a libsql row (array) + columns (array of strings) → plain object
 * Also converts BigInt values (which libsql returns for INTEGER columns) to Number
 */
function rowToObject(columns, row) {
  const obj = {};
  for (let i = 0; i < columns.length; i++) {
    const val = row[i];
    obj[columns[i]] = typeof val === 'bigint' ? Number(val) : val;
  }
  return obj;
}

module.exports = { initDb, run, get, all, insert };
