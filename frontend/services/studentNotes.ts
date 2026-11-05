import * as Crypto from 'expo-crypto';
import { getDatabase } from './database';
import { notifySchoolDataChanged } from './syncEvents';

/** One teacher note per student. Stored and editable while completely offline. */
export async function getStudentNote(studentId: number): Promise<string> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ body: string }>(
    'SELECT body FROM student_notes WHERE student_id=? AND sync_deleted=0', studentId,
  );
  return row?.body ?? '';
}

export async function saveStudentNote(studentId: number, body: string): Promise<void> {
  if (!Number.isSafeInteger(studentId) || studentId <= 0) throw new Error('Neplatné ID žiaka.');
  const value = body.trim();
  if (value.length > 5000) throw new Error('Poznámka môže mať maximálne 5000 znakov.');
  const db = await getDatabase();
  const student = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM students WHERE id=? AND sync_deleted=0', studentId,
  );
  if (!student) throw new Error('Žiak neexistuje.');
  const existing = await db.getFirstAsync<{ id: number; body: string; sync_deleted: number }>(
    'SELECT id,body,sync_deleted FROM student_notes WHERE student_id=?', studentId,
  );
  if (!existing && !value) return;
  if (existing && existing.body === value && Boolean(existing.sync_deleted) === !Boolean(value)) return;
  if (existing) {
    await db.runAsync(`UPDATE student_notes
      SET body=?,sync_deleted=?,sync_dirty=1,sync_op_id=? WHERE id=?`,
      value, value ? 0 : 1, Crypto.randomUUID(), existing.id);
  } else {
    await db.runAsync(`INSERT INTO student_notes
      (student_id,body,sync_id,sync_op_id,sync_deleted)
      VALUES(?,?,?,?,0)`, studentId, value, Crypto.randomUUID(), Crypto.randomUUID());
  }
  notifySchoolDataChanged();
}
