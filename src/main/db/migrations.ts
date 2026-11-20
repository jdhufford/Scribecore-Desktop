// Numbered schema migrations (SPEC 7). PRAGMA user_version holds the schema
// version; each migration runs in one transaction with the version bump.
// Never edit a migration that has shipped: add a new one.

export interface Migration {
  version: number
  description: string
  sql: string
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'Initial schema',
    sql: `
      CREATE TABLE meta (
        key   TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE activities (
        id          INTEGER PRIMARY KEY,
        date        TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        task        TEXT NOT NULL CHECK (length(trim(task)) > 0),
        notes       TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        deleted_at  TEXT
      );
      CREATE INDEX idx_activities_date ON activities (date DESC, created_at DESC);
      CREATE INDEX idx_activities_deleted ON activities (deleted_at);

      CREATE TABLE tags (
        id    INTEGER PRIMARY KEY,
        name  TEXT NOT NULL UNIQUE COLLATE NOCASE
              CHECK (length(name) BETWEEN 1 AND 50 AND instr(name, ',') = 0)
      );

      CREATE TABLE activity_tags (
        activity_id INTEGER NOT NULL REFERENCES activities (id) ON DELETE CASCADE,
        tag_id      INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
        PRIMARY KEY (activity_id, tag_id)
      ) WITHOUT ROWID;
      CREATE INDEX idx_activity_tags_tag ON activity_tags (tag_id);

      CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      );
    `,
  },
]

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version
