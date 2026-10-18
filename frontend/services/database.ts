import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

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

      // RA-14: append the next migration here; preserve existing rows and IDs.
    });

    return db;
  } catch (error) {
    await db.closeAsync();
    throw error;
  }
}
