const path = require('path');
const fs   = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'attendance.db');

let SQL;
let db;

function save() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function initDb() {
  if (db) return;

  const initSqlJs = require('sql.js');
  SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }

  initSchema();
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS teachers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      email      TEXT    NOT NULL UNIQUE,
      password   TEXT    NOT NULL,
      role       TEXT    NOT NULL DEFAULT 'teacher',
      photo      TEXT,
      created_at TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS classes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      name       TEXT    NOT NULL,
      subject    TEXT,
      created_at TEXT    DEFAULT (datetime('now')),
      FOREIGN KEY (teacher_id) REFERENCES teachers(id)
    );

    CREATE TABLE IF NOT EXISTS students (
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
    );

    CREATE TABLE IF NOT EXISTS student_accounts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id  INTEGER NOT NULL UNIQUE,
      username    TEXT    NOT NULL UNIQUE,
      password    TEXT    NOT NULL,
      created_at  TEXT    DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id  INTEGER NOT NULL,
      class_id    INTEGER NOT NULL,
      scanned_at  TEXT    DEFAULT (datetime('now')),
      date        TEXT    NOT NULL,
      status      TEXT    DEFAULT 'present',
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (class_id)   REFERENCES classes(id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique
      ON attendance(student_id, class_id, date);
  `);

  // Add role column to existing teachers tables that may not have it
  try { db.run("ALTER TABLE teachers ADD COLUMN role TEXT NOT NULL DEFAULT 'teacher'"); } catch {}
  // Add photo column to teachers
  try { db.run("ALTER TABLE teachers ADD COLUMN photo TEXT"); } catch {}
  // Migrate existing students table — add new columns if they don't exist yet
  const newCols = ['phone TEXT', 'lrn TEXT', 'grade_level TEXT', 'section TEXT', 'student_code TEXT', 'photo TEXT'];
  for (const col of newCols) {
    try { db.run(`ALTER TABLE students ADD COLUMN ${col}`); } catch {}
  }

  save();

  // Seed default admin
  const existing = get('SELECT id FROM teachers WHERE role = ?', ['admin']);
  if (!existing) {
    const hash = bcrypt.hashSync('admin123', 10);
    insert('INSERT INTO teachers (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Admin', 'admin@rnhs.edu.ph', hash, 'admin']);
    console.log('✅ Default admin created: admin@rnhs.edu.ph / admin123');
  }
}

/* ── Query helpers ── */

function run(sql, params = []) {
  db.run(sql, params);
  save();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function insert(sql, params = []) {
  db.run(sql, params);
  const rowid = db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0];
  save();
  return rowid;
}

module.exports = { initDb, run, get, all, insert, save };
