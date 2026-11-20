# ScribeCore Desktop: Specification v0.1 (draft)

Status: draft, 2026-11-20. Decisions updated the same day (GitHub hosting, UI framework, filters, idle lock, x64)
Source reviewed: ScribeCore `main` @ 47ccdac (Flask 3.0 + SQLite, the version in production)

## 1. Summary

ScribeCore Desktop is a free, open-source (GPL-3.0) Windows app for logging work activities and
pulling them back out for annual evaluations. It is a full rewrite of the ScribeCore web app in
Electron. It keeps the web app's features and data model, drops everything server-related, and
stores all data in a local SQLite file that can be encrypted. It makes no network calls.

It lives in a new public GitHub repository (`github.com/jdhufford/Scribecore-Desktop`).
The existing private ScribeCore repo and the production server are not changed.

## 2. Decisions so far

| Topic | Decision |
|---|---|
| Audience | Public release |
| Approach | Full rewrite. No code shared with the Flask app |
| Stack | Electron + SQLite |
| Login | None by default. Optional app password |
| Password effect | Encrypts the database (SQLCipher-compatible) |
| Migration from web | None. Start fresh (CSV import is still available) |
| Platforms | Windows 10 (22H2) and Windows 11, x64 only |
| Code signing | Purchased OV certificate |
| Data location | `%APPDATA%\ScribeCore` by default, plus a portable build |
| Updates | Manual downloads only. No update checks |
| Repo / hosting | Public GitHub repo `jdhufford/Scribecore-Desktop`, installers on GitHub Releases (changed from Gitea 2026-11-20) |
| License | GPL-3.0-or-later, free |
| Installers | Per-user NSIS `.exe` (no admin), per-machine `.msi` for IT, portable `.zip` |
| Date display | Windows regional format. Stored and exported as ISO `YYYY-MM-DD` |
| New in 1.0 | Date-range reports, better import, tag management, trash/undo |
| UI framework | Svelte + TypeScript |
| Multi-tag filter | AND by default, with an AND/OR toggle |
| Idle lock | Yes, minutes set by the user |
| Name | ScribeCore |
| Bulk actions | After 1.0 |

## 3. Out of scope

Removed from the web version and not planned:
- REST API, API keys, rate limiting, the `api_usage` table, `/api/health`
- MCP server and any AI or LLM integration
- User accounts, registration, the `ALLOW_REGISTRATION` setting, login lockout
- CSRF, `SECRET_KEY`, sessions (no web server, so none of these apply)
- Mobile layout: hamburger menu, "Force Mobile View", touch detection
- Sync between computers, or with the web version
- Telemetry, analytics, crash reporting to any server
- Auto-update

## 4. Feature parity with the web app (must have)

| Web feature (source) | Desktop behavior |
|---|---|
| Create, edit and delete an activity: date, task, notes, tags (`app.py` 614-790) | Same. Delete moves the entry to Trash (section 5.4) |
| Activity list, newest first (`app.py` 594) | Same sort: date desc, then created_at desc |
| Text search over task and notes (`LIKE`) | Same, case-insensitive, with a 250 ms debounce as today. Use FTS5 only if lists get slow (not expected) |
| Tag sidebar with counts (`/api/tags`) | Same. Hide tags whose only uses are in Trash |
| Multi-tag filter (`app.js` 254-345) | Same, with an explicit AND/OR toggle next to the selected tags. Default AND (entry has all selected tags). The toggle state is remembered |
| Tag suggestions from keywords (`extract_keywords`, `suggest_tags`) | Port the algorithm as-is. Runs locally. Replace the duplicate stop-word list with a cleaned one |
| CSV import | Rewritten (section 5.2) |
| CSV and XLSX export | Same columns (Date, Task, Notes, Tags), via a native Save dialog instead of a browser download |
| Light and dark theme | Light, Dark and **System** (follows Windows), with System as the default |
| Normal and compact view | Same |
| Settings drawer | Becomes a Settings page or dialog. App menu bar: File, Edit, View, Help |

## 5. New in 1.0

### 5.1 Date-range reports
- Choose a range with presets: This year, Last year, Last 12 months, a custom range, and an
  optional "evaluation period" start month saved in Settings (for example July to June).
- Report view: total entries, days logged, entries per month (a simple bar chart), top tags,
  and entries grouped by tag or by month.
- Export the range as CSV, XLSX, or a printable report (HTML to PDF through Electron's
  `printToPDF`).
- Combine with tag and text filters. Exports respect the current filter. The current web export
  always dumps everything.

### 5.2 Better import
- Accepts `.csv` and `.xlsx`.
- Encoding: detect a UTF-8 BOM, UTF-8, UTF-16 (Excel "Unicode Text") and Windows-1252.
  The current code fails on a BOM because the header becomes `﻿Date`, so every row is skipped.
- Headers: match case-insensitively with whitespace trimmed. Map the columns Date, Task, Notes
  and Tags, and let the user choose a column when headers don't match.
- Dates: accept ISO, `M/D/YYYY`, `D/M/YYYY` (ambiguous dates are resolved by the user's locale,
  shown in the preview), and Excel serial date numbers in XLSX. Store ISO only. Reject impossible
  dates. The current code stores any string, so `11/20/2026` sorts incorrectly.
- Preview before committing, flagging rows as new, duplicate or invalid with a reason.
- Duplicates are rows with the same date and task (case- and whitespace-insensitive) and notes.
  Default: skip. Option: import anyway.
- All-or-nothing transaction, followed by a summary. The current code prints errors to stdout.
- Tags split on `,` and `;`, are trimmed and lowercased, and duplicates within a row are dropped.
- Limits: warn above 10,000 rows. Reject files over 50 MB.
- A sample template is available from the Import dialog.

### 5.3 Tag management
- A Tags screen showing name, entry count and last used date.
- Rename a tag. Renaming to an existing name offers a merge.
- Merge several tags into one.
- Delete a tag. It is removed from its entries, which are kept, after a confirmation that shows
  how many entries it affects.
- Clean up tags not used by any entry. The web app never deletes tags.
- Tag rules: lowercase, trimmed, 1 to 50 characters, with no commas because commas are the
  export separator.

### 5.4 Trash and undo
- Deleting sets `deleted_at` and shows a "Deleted. Undo" toast for about 8 seconds.
- A Trash view lists deleted entries with Restore and Delete forever.
- Entries are purged automatically after 30 days (checked at startup). Empty Trash asks for
  confirmation.
- Bulk delete and bulk tag changes come after 1.0.

### 5.5 App password and encryption
- Off by default. Settings > Security > "Protect with password".
- Turning it on re-keys the database with SQLCipher (`better-sqlite3-multiple-ciphers`, MIT,
  compatible with GPL) and shows a **recovery key** once, with a strong prompt to save or
  print it. Either the password or the recovery key opens the database.
- Turning it off asks for the password, then decrypts.
- Changing the password re-keys the database.
- An unlock screen appears at launch.
- Idle lock: Settings > Security > "Lock after [N] minutes idle", off by default, 1 to 240
  minutes. Locking closes the database and drops the key from memory. Unsaved form content is
  kept in memory (not on disk) and restored after unlocking. Only available when a password is set.
- Forgotten password plus lost recovery key means the data is unrecoverable. Say so plainly in
  the UI and the docs. There is no backdoor.
- Password rule: at least 8 characters. No lockout, since a local attacker can copy the file
  anyway. Rely on the KDF cost (SQLCipher 4 defaults, PBKDF2-SHA512 with 256k iterations) instead.
- Exports (CSV, XLSX, PDF) are **plain text**. Warn once when exporting from an encrypted
  database.
- Backups (5.6) stay encrypted with the same key.
- Out of scope for 1.0: Windows Hello unlock (a possible later addition through DPAPI and
  Hello-protected key storage).

### 5.6 Backups
- Automatic: on the first launch each day, copy the database to `<data dir>\backups\` with the
  SQLite online backup API (safe while the database is open). Keep 7 daily and 4 weekly copies.
- Manual: File > Back up now (Save dialog) and File > Restore from backup. Restoring first saves
  the current database as a backup.
- Restore checks that the file opens, has the right schema version, and asks for the password
  if it is encrypted.
- As built: daily files are `scribecore-YYYY-MM-DD.db` (local date). Safety copies made before
  a schema upgrade or a restore are `scribecore-YYYY-MM-DD-<reason>.db`; the newest 5 are kept.
  Backups are written to a temp file, switched to a single-file journal mode (no `-wal`/`-shm`
  side files, readable from read-only media), then renamed into place.
- Milestone 6 must re-verify that a backup of an encrypted database is itself encrypted.

## 6. Architecture

- **Electron** (a current stable release; pin the exact version when the repo is created).
  Main process plus one renderer window.
- **No local HTTP server.** The renderer calls the main process through `contextBridge` and IPC
  only, so no localhost port is open for other users or processes on the PC to reach.
- Security settings: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, a
  strict CSP (`default-src 'self'`), no remote content, and navigation and `window.open`
  blocked. External links open in the default browser only for an allow-list (the project
  repo).
- **Database:** `better-sqlite3-multiple-ciphers`, synchronous and in the main process, with
  WAL mode and `foreign_keys = ON`.
- **Single instance** (`app.requestSingleInstanceLock`). A second launch focuses the existing
  window. This prevents two processes opening the same database, especially in portable mode.
- **Renderer UI:** Svelte 5 + TypeScript, built with electron-vite.
- **Packaging:** `electron-builder`, producing NSIS (per-user), MSI (per-machine) and a
  portable zip, x64 only.
- **Logs:** local only, at `<data dir>\logs\`, rotated, and never containing entry text.

## 7. Data model (schema v1)

```sql
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);          -- schema_version, created_with
CREATE TABLE activities (
  id          INTEGER PRIMARY KEY,
  date        TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  task        TEXT NOT NULL CHECK (length(trim(task)) > 0),
  notes       TEXT,
  created_at  TEXT NOT NULL,   -- ISO 8601 UTC, written by the app
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT             -- NULL = live; set = in Trash
);
CREATE INDEX idx_activities_date ON activities(date DESC, created_at DESC);
CREATE TABLE tags (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (instr(name, ',') = 0)
);
CREATE TABLE activity_tags (
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (activity_id, tag_id)
);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);      -- theme, view, eval period, etc.
```

Changes from the web schema:
- No `users`, `api_keys` or `api_usage`, and no `user_id` columns.
- Timestamps are always ISO UTC written by the app. The web app mixes SQLite `CURRENT_TIMESTAMP`
  (UTC, with a space separator) and Python `datetime.now()` (local time).
- `deleted_at` adds the Trash.
- Migrations are numbered scripts run at startup inside a transaction, with an automatic backup
  first. A database from a newer app version is refused with a clear message rather than opened.

As built (milestone 2, 2026-11-20):
- The schema version is `PRAGMA user_version`. `meta` holds `created_with` and
  `last_opened_with` (app versions).
- Pragmas: WAL journal, `synchronous = FULL` (an entry the user saw as saved survives a power
  cut), foreign keys on, 5-second busy timeout.
- An empty file with other programs' tables, or a non-SQLite file, is refused rather than
  modified.
- Limits: task up to 500 characters; tags have inner whitespace collapsed (`"project   alpha"`
  becomes `"project alpha"`).
- Search uses `LIKE` with `%` and `_` escaped, so they match literally.
- Tags used only by entries in Trash are kept, so restoring an entry restores its tags.
- Library: `better-sqlite3-multiple-ciphers` (pinned 13.0.3). Tests run inside Electron's Node
  runtime so they exercise the same native binary the app ships.

## 8. Storage locations

| Build | Data directory |
|---|---|
| NSIS per-user / MSI | `%APPDATA%\ScribeCore\` (`scribecore.db`, `backups\`, `logs\`) |
| Portable zip | `<exe folder>\data\`. Detected by a `portable.flag` file next to the exe |

- Settings > Data shows the path, with an "Open folder" button.
- Chromium's own files (cache, local storage) go in `<data dir>\chromium\`, so a portable copy
  writes nothing to the user profile.
- Development runs (`npm run dev`) use `%APPDATA%\ScribeCore-dev\`, never real data.
- The portable zip gets `portable.flag` from an electron-builder hook
  (`scripts/add-portable-flag.cjs`); the installers never contain it.
- Placing the live database in a sync folder (OneDrive, Dropbox) is not supported. If the data
  directory is detected inside one, show a warning. Backups there are fine.
- Portable build on a read-only location: show a clear error at startup and offer to switch to
  `%APPDATA%`.
- The MSI installs per-machine, but data stays per Windows user in `%APPDATA%`.

## 9. Build, signing and release

- **Certificate:** OV code-signing certificate. Since June 2023 the private key must live on a
  hardware token or a cloud HSM. Pick one that can sign on the build machine; for unattended
  builds a cloud HSM (for example DigiCert KeyLocker, SSL.com eSigner or Sectigo cloud) fits
  better than a USB token.
- **What is signed:** the app exe, the NSIS installer and uninstaller, the MSI, the exe in the
  portable build, and native modules (`.node`). Use RFC 3161 timestamping so signatures stay
  valid after the certificate expires.
- **SmartScreen:** a new OV certificate starts with no reputation, so early downloads will still
  see warnings until enough installs accumulate. EV no longer skips this. Document it on the
  release page.
- **Build host:** GitHub Actions `windows-latest` runners (free for public repos). Signing in CI
  needs a cloud HSM certificate; a USB token only works on a local machine.
- **Release artifacts** on GitHub Releases: `ScribeCore-Setup-x.y.z.exe`,
  `ScribeCore-x.y.z.msi`, `ScribeCore-x.y.z-portable.zip` and `SHA256SUMS.txt`.
- **Versioning:** SemVer. Help > About shows the version and links to the release page, opened
  manually by the user.
- **MSI for IT:** supports silent install (`msiexec /i ... /qn`), and its uninstall leaves user
  data in place.
- **Uninstall:** keeps `%APPDATA%\ScribeCore` by default. The NSIS uninstaller offers an
  optional "Also delete my data" checkbox, unchecked.

## 10. UX details and edge cases

- Window minimum size of 900x600. Window size, position and maximized state are remembered and
  reset if the saved position is off-screen (for example after a monitor is unplugged).
- Keyboard: Ctrl+N new entry, Ctrl+F search, Ctrl+S save form, Esc cancel, Ctrl+Z undo the last
  delete, and Delete moves the selected entry to Trash.
- Leaving a form with unsaved changes asks for confirmation. Closing the app with unsaved
  changes asks too.
- A new entry defaults to today's local date. The web version's `setDefaultDate` uses local
  time; keep that and never use UTC for the entry date.
- Future dates are allowed, with a soft warning when more than 1 day ahead.
- Very long notes: no hard limit. Collapse to 3 lines in the list with an option to expand.
- Text is stored as entered. The renderer escapes HTML as it does today, and the CSP blocks
  injected script anyway.
- Notes with line breaks, commas and quotes must survive a CSV round trip. Test it.
- CSV export adds a UTF-8 BOM so Excel opens accented characters correctly. Import strips it.
- XLSX export writes dates as real Excel dates, not strings.
- Native dialogs replace `alert()` and `confirm()`.
- High-DPI, 125% and 150% scaling, Windows high-contrast mode, and keyboard-only navigation are
  supported. Screen-reader labels go on every icon button. The current UI uses emoji-only
  buttons.
- Running from a network drive or a path with non-ASCII characters (for example a user name
  with accents) must work.
- Disk full or the database locked by antivirus: show an error and never lose the form contents.
- Language: English only in 1.0, but put UI strings in one file so translation is possible later.

## 11. Testing

- Unit tests for the database layer, migrations, import parsing (fixtures: BOM, cp1252, UTF-16,
  M/D/Y, D/M/Y, Excel serial dates, embedded newlines, duplicates), keyword suggestion, and the
  report math.
- End-to-end tests with Playwright for Electron: create, edit, delete, undo, filter, export,
  import, enabling and disabling encryption, and restore.
- Manual matrix: Windows 10 22H2 and Windows 11 24H2/25H2; install, upgrade and uninstall for
  NSIS, MSI and portable; a standard (non-admin) account; Defender SmartScreen behavior on a
  clean VM.

## 12. Open questions

1. ~~Public downloads from the homelab~~: resolved 2026-11-20, hosting moved to GitHub.
2. **Name.** ScribeCore (decided 2026-11-20). The certificate's publisher name (your legal name
   or a business) is what Windows shows to users.
3. **Signing certificate type.** Undecided. Recommendation: a cloud-HSM OV certificate, since
   builds run on GitHub Actions and a USB token cannot sign there. Needed only at milestone 7.
4. **A "check for updates" link:** confirm that Help > About only *links* to the releases page
   and never fetches anything.
5. **Importing from the web version later.** We chose to start fresh. Should CSV exports from the
   web version still be a tested import fixture? Recommended, since it costs little.

## 13. Milestones (proposed)

1. Repo scaffold: Electron, TypeScript, electron-builder, lint and test setup, GPL-3 license,
   README.
2. Database layer, schema v1, migrations, backups.
3. Core UI at parity: entries, tags, search, filter, suggestions, theme and view modes.
4. Import and export (5.2), Trash (5.4), Tag management (5.3).
5. Reports (5.1).
6. Encryption (5.5).
7. Packaging and signing, then a test matrix on clean Windows 10 and 11 VMs.
8. 1.0 release on GitHub.
