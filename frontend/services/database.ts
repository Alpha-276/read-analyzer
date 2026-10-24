import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

const DATABASE_NAME = 'read-analyzer.db';
let databasePromise: Promise<SQLiteDatabase> | undefined;

// Every service waits for the same initialization, including concurrent calls.
export function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openAndInitializeDatabase().catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }

  return databasePromise;
}

// Optional startup call. Services also initialize the database on first use.
export async function initializeDatabase(): Promise<void> {
  await getDatabase();
}

async function openAndInitializeDatabase(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(DATABASE_NAME);

  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
    `);

    // The connection is not exposed until this transaction finishes.
    await db.withTransactionAsync(async () => {
      const version = await db.getFirstAsync<{ user_version: number }>(
        'PRAGMA user_version',
      );

      if ((version?.user_version ?? 0) < 1) {
        await db.execAsync(`
          CREATE TABLE classes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL CHECK (length(trim(name)) > 0)
          );

          CREATE TABLE students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
            first_name TEXT NOT NULL CHECK (length(trim(first_name)) > 0),
            last_name TEXT NOT NULL CHECK (length(trim(last_name)) > 0)
          );

          CREATE INDEX idx_students_class_id ON students(class_id);
        `);

        // Sprint 1 demo data is inserted once, together with schema version 1.
        const demoClass = await db.runAsync(
          'INSERT INTO classes (name) VALUES (?)',
          '1.A (demo)',
        );

        for (const [firstName, lastName] of [
          ['Ján', 'Novák'],
          ['Ema', 'Kováčová'],
          ['Adam', 'Horváth'],
        ] as const) {
          await db.runAsync(
            'INSERT INTO students (class_id, first_name, last_name) VALUES (?, ?, ?)',
            demoClass.lastInsertRowId,
            firstName,
            lastName,
          );
        }

        await db.execAsync('PRAGMA user_version = 1');
      }

      // RA-13: recording metadata stays on the phone, without touching RA-7 rows.
      if ((version?.user_version ?? 0) < 2) {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS recordings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            student_first_name TEXT NOT NULL,
            student_last_name TEXT NOT NULL,
            text_id TEXT NOT NULL,
            uri TEXT NOT NULL UNIQUE,
            duration_seconds INTEGER NOT NULL,
            processing_status TEXT NOT NULL DEFAULT 'unprocessed'
              CHECK (processing_status IN ('unprocessed', 'pending', 'processing', 'done', 'error')),
            task_id TEXT,
            transcript TEXT,
            comparison_json TEXT,
            error TEXT,
            saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_recordings_student_id ON recordings(student_id);
          PRAGMA user_version = 2;
        `);
      }
      // Remote sync v3; never replace existing local INTEGER primary keys.
      if ((version?.user_version ?? 0) < 3) {
        await db.execAsync(`
          ALTER TABLE classes ADD COLUMN sync_id TEXT;
          ALTER TABLE classes ADD COLUMN sync_op_id TEXT;
          ALTER TABLE classes ADD COLUMN server_version INTEGER NOT NULL DEFAULT 0;
          ALTER TABLE classes ADD COLUMN sync_dirty INTEGER NOT NULL DEFAULT 1;
          ALTER TABLE classes ADD COLUMN sync_deleted INTEGER NOT NULL DEFAULT 0;
          ALTER TABLE students ADD COLUMN sync_id TEXT;
          ALTER TABLE students ADD COLUMN sync_op_id TEXT;
          ALTER TABLE students ADD COLUMN server_version INTEGER NOT NULL DEFAULT 0;
          ALTER TABLE students ADD COLUMN sync_dirty INTEGER NOT NULL DEFAULT 1;
          ALTER TABLE students ADD COLUMN sync_deleted INTEGER NOT NULL DEFAULT 0;
          CREATE TABLE school_sync_state (id INTEGER PRIMARY KEY CHECK(id=1), cursor INTEGER NOT NULL DEFAULT 0);
          INSERT INTO school_sync_state(id,cursor) VALUES(1,0);
        `);
        for (const table of ['classes', 'students'] as const) {
          const rows = await db.getAllAsync<{ id: number }>(`SELECT id FROM ${table} WHERE sync_id IS NULL`);
          for (const row of rows) {
            await db.runAsync(`UPDATE ${table} SET sync_id=?, sync_op_id=? WHERE id=?`,
              Crypto.randomUUID(), Crypto.randomUUID(), row.id);
          }
        }
        await db.execAsync(`
          CREATE UNIQUE INDEX idx_classes_sync_id ON classes(sync_id);
          CREATE UNIQUE INDEX idx_students_sync_id ON students(sync_id);
          PRAGMA user_version = 3;
        `);
      }
      // RA-14: offline teacher notes and durable last successful sync time.
      if ((version?.user_version ?? 0) < 4) {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS student_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL UNIQUE REFERENCES students(id) ON DELETE RESTRICT,
            body TEXT NOT NULL DEFAULT '',
            sync_id TEXT NOT NULL UNIQUE,
            sync_op_id TEXT,
            server_version INTEGER NOT NULL DEFAULT 0,
            sync_dirty INTEGER NOT NULL DEFAULT 1,
            sync_deleted INTEGER NOT NULL DEFAULT 0
          );
          ALTER TABLE school_sync_state ADD COLUMN last_success_at TEXT;
          PRAGMA user_version = 4;
        `);
      }
    });

    return db;
  } catch (error) {
    await db.closeAsync();
    throw error;
  }
}
