# Investigation: `scanned_at` timezone handling

## Summary (the answer first)

The 8-hour mismatch is real and has **two compounding root causes**, both UTC:

1. **Storage is UTC.** SQLite's `datetime('now')` — the `DEFAULT` for the `scanned_at` column — returns UTC with no timezone marker (e.g. `2024-01-15 02:53:00` means 02:53 UTC). The scan endpoint never sets `scanned_at` explicitly, so every record inherits this UTC default. The "today" date is also computed in UTC.

2. **The frontend treats that UTC value as local time.** Every display call does `new Date(isoStr)` where `isoStr` is `"2024-01-15 02:53:00"` (space-separated, no `Z`). Browsers parse such a string as *local* time, then `toLocaleTimeString()` prints it — so the raw UTC clock reading (02:53) is shown verbatim with no conversion.

Net effect for a PHT (UTC+8) user: scan at **10:54 AM local** → stored as **02:53 UTC** → displayed as **"2:53 AM"**. Exactly the screenshot.

The fix is to store PHT wall-clock time and compute "today" in PHT. That is a backend-only change; the existing frontend then renders correctly for the school's single timezone. Details and a portable alternative are in Recommendations.

---

## Evidence (file / symbol / line)

### Backend — storage (UTC)

**`backend/src/database.js` — `initSchema()`**
- Line 93: `scanned_at  TEXT    DEFAULT (datetime('now'))` inside the `attendance` table definition (lines 89–99). `datetime('now')` is SQLite's UTC now, format `YYYY-MM-DD HH:MM:SS`, no zone suffix. This is the primary source of UTC.
- (Related, not the focus: `created_at TEXT DEFAULT (datetime('now'))` at lines 55, 62, 78, 86 — same UTC behavior, but only `scanned_at` is shown to users as a time.)

**`backend/src/routes/attendance.js` — `POST /scan`** (lines 12–46)
- Line 28: `const today = new Date().toISOString().split('T')[0];` — "today" computed in **UTC** (toISOString is always UTC). A scan between 00:00–08:00 PHT is filed under the *previous* UTC date.
- Lines 18–21 (already-marked branch): returns `scanned_at: existing.scanned_at` unchanged from the DB.
- Lines 38–39: `await insert('INSERT INTO attendance (student_id, class_id, date) VALUES (?, ?, ?)', [student.id, class_id, today]);` — note `scanned_at` is **not** supplied, so the column takes its UTC `DEFAULT`.
- Lines 41–44: re-reads the just-inserted `scanned_at` (UTC) and returns it in the JSON response.

**`backend/src/routes/attendance.js` — `GET /api/attendance`** (lines 50–69)
- Returns `a.scanned_at` straight from the DB (UTC), no conversion. `ORDER BY a.scanned_at DESC` (line 66) also operates on the UTC strings.

**`backend/src/routes/attendance.js` — `GET /api/attendance/today`** (lines 113–156)
- Line 130: `const today = new Date().toISOString().split('T')[0];` — same UTC "today" as `/scan`.
- Lines 134–137: selects `scanned_at` for the day.
- Lines 147–149: maps `scanned_at: rec ? rec.scanned_at : null` and sends it unconverted.

**`backend/src/routes/attendance.js` — `POST /api/attendance/manual`** (lines 158–187)
- Lines 179–181 / 183–186: the INSERT also omits `scanned_at`, so a manual mark gets a UTC-default scan time too (a minor wart — manual marks have no real "scan time", but it will still show as UTC).

**`backend/src/server.js`**
- Line 19: `res.json({ status: 'ok', time: new Date().toISOString() });` — health endpoint only, not user-facing attendance. No change needed.

### Frontend — display (interprets UTC as local)

**`frontend/src/api.js`** — confirmed pass-through
- `scanQR` (lines 84–86) returns `r.json()` with no transformation; `getAttendance*` helpers use the generic `request()` which also returns raw JSON. `scanned_at` is never referenced in `api.js`, so nothing converts or relabels it between backend and UI.

**`frontend/src/pages/DashboardPage.js`**
- Lines 24–26 — `fmtTime(isoStr)`:
  ```js
  function fmtTime(isoStr) {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleTimeString('en-US',
      { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  }
  ```
  This is the central formatter and the main bug surface. `new Date("2024-01-15 02:53:00")` is parsed as local, so the UTC value prints unchanged.
- Line 182: CSV export (today view) — `s.scanned_at ? fmtTime(s.scanned_at) : '—'`.
- Line 188: CSV export (records view) — `fmtTime(r.scanned_at)`.
- Lines 498–499: `TodayTable` "Scanned At" cell — `{fmtTime(s.scanned_at)}`.
- Line 610: `RecordsTable` "Time Scanned" cell — `{fmtTime(r.scanned_at)}`.
- Lines 201–202: the dashboard header's **live clock** uses `now` (browser local) via `toLocaleDateString`/`toLocaleTimeString`. This is correct and unaffected — it is *not* `scanned_at`. (This is why the header clock looks right while scan times look wrong.)

**`frontend/src/pages/StudentPortalPage.js`**
- Line 250:
  ```js
  {new Date(a.scanned_at).toLocaleTimeString()}
  ```
  Same parse-as-local bug, no format options. Shows the UTC value verbatim.

**`frontend/src/pages/ScannerPage.js`**
- Lines 159 and 168: `time: new Date().toLocaleTimeString()` — this is the **scan-result banner / session log** timestamp, captured from the browser's local clock *at the moment of scan*. It does **not** use `scanned_at`. So this one is already correct local time (it would show ~10:54). Worth noting because it creates a visible inconsistency: the session log says 10:54 while the dashboard/portal record says 2:53.
- No `scanned_at` reference in this file.

**`frontend/src/pages/TeachersPage.js`** (out of scope, noted for completeness)
- Line 118: `new Date(t.created_at).toLocaleDateString()` — same class of bug, but for `created_at`, not `scanned_at`. Not part of this task.

---

## Conclusions

- The mismatch is **not** a frontend-only bug and **not** a backend-only bug — it is the combination. If the backend stored PHT wall-clock, the existing parse-as-local frontend would render correctly for PHT users. If the backend stored a real ISO-8601 UTC timestamp (with `Z`), the existing `new Date(...).toLocaleTimeString()` would correctly convert to local. The current code does neither: it stores a *bare* UTC string that the frontend silently re-reads as local.
- The "today" computation in `/scan` and `/today` (line 28 / line 130) is also UTC, so the day bucket is UTC too. Near PHT midnight this files scans on the wrong calendar day. Worth fixing in the same pass.
- Existing rows already in the database are UTC and will **not** be corrected by changing the `DEFAULT` — the new default only affects future inserts. A backfill is needed to repair historical data (see below).

## Recommendations (implement nothing here)

The user's request is "make it match the philippine time." The smallest correct change that satisfies that, and that keeps the existing frontend working, is **Option A**.

### Option A (recommended — backend-only, matches "Philippine time")

Store PHT wall-clock in SQLite and compute "today" in PHT. The frontend already parses a bare datetime as local, so for a PHT user it will then display the correct PHT time with zero frontend edits.

1. `backend/src/database.js` line 93 — change the `scanned_at` default:
   - from: `scanned_at  TEXT    DEFAULT (datetime('now'))`
   - to:   `scanned_at  TEXT    DEFAULT (datetime('now', '+8 hours'))`
   - (Optionally apply the same to the four `created_at` defaults at lines 55/62/78/86 for consistency, though none are shown as a time-of-day.)
2. `backend/src/routes/attendance.js` lines 28 and 130 — replace the UTC "today" with a PHT date string. A safe one-liner that yields `YYYY-MM-DD`:
   - from: `const today = new Date().toISOString().split('T')[0];`
   - to:   `const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });`
3. No frontend changes required. (`fmtTime` and the StudentPortal call keep working because the stored value is now PHT wall-clock.)

Caveat — existing data is still UTC:
- Add a one-time backfill, e.g. in a migration or a manual SQL run:
  `UPDATE attendance SET scanned_at = datetime(scanned_at, '+8 hours') WHERE scanned_at IS NOT NULL;`
- The `date` column on existing rows was derived from UTC and may be off by one day for the few rows scanned in the PHT 00:00–08:00 window; repairing `date` historically is harder and low-value (only edge rows are affected). New rows will be correct after the fix.

### Option B (more portable — for the record, not recommended here)

Keep storage as true UTC but make it unambiguous and convert at display time:
- Backend: write an explicit ISO-8601 timestamp with `Z` instead of relying on the bare `datetime('now')` default — e.g. insert `new Date().toISOString()` into `scanned_at`, and keep "today" as PHT (same `toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })`).
- Frontend: pass `timeZone: 'Asia/Manila'` into every `toLocaleTimeString` call (DashboardPage `fmtTime` lines 24–26, StudentPortalPage line 250) and replace the ScannerPage local-clock `time` (lines 159/168) with `data.scanned_at` rendered the same way so the banner matches the record.

This is correct for users in any timezone, but it touches more files and is more than the user asked for. Given the app serves a single Philippine school, Option A is the cleaner fit.

---

## Files this fix would touch (for the planner)

- `backend/src/database.js` (line 93, optionally 55/62/78/86)
- `backend/src/routes/attendance.js` (lines 28 and 130; optionally a backfill migration)
- Frontend: **none** under Option A. Under Option B: `frontend/src/pages/DashboardPage.js` (lines 24–26), `frontend/src/pages/StudentPortalPage.js` (line 250), `frontend/src/pages/ScannerPage.js` (lines 159, 168).
