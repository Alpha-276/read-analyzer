import * as Crypto from 'expo-crypto';
import { getDatabase } from './database';
import { notifySchoolDataChanged } from './syncEvents';
import type {
  AddStudentInput,
  SchoolClass,
  Student,
  UpdateStudentInput,
} from './types';

const STUDENT_COLUMNS =
  'id, class_id AS classId, first_name AS firstName, last_name AS lastName';

function requiredText(value: string, label: string): string {
  const text = value.trim();

  if (!text) {
    throw new Error(`${label}: hodnota nesmie byť prázdna.`);
  }

  return text;
}

function requireId(id: number): void {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('ID musí byť kladné celé číslo.');
  }
}

export async function createClass(name: string): Promise<SchoolClass> {
  const trimmedName = requiredText(name, 'Názov triedy');
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO classes (name, sync_id, sync_op_id) VALUES (?, ?, ?)',
    trimmedName, Crypto.randomUUID(), Crypto.randomUUID(),
  );

  notifySchoolDataChanged();
  return { id: result.lastInsertRowId, name: trimmedName };
}

export async function listClasses(): Promise<SchoolClass[]> {
  const db = await getDatabase();

  return db.getAllAsync<SchoolClass>(
    'SELECT id, name FROM classes WHERE sync_deleted=0 ORDER BY name, id',
  );
}

export async function addStudent(input: AddStudentInput): Promise<Student> {
  const { classId } = input;
  requireId(classId);
  const firstName = requiredText(input.firstName, 'Meno');
  const lastName = requiredText(input.lastName, 'Priezvisko');
  const db = await getDatabase();
  const schoolClass = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM classes WHERE id = ?',
    classId,
  );

  if (!schoolClass) {
    throw new Error('Trieda neexistuje.');
  }

  const result = await db.runAsync(
    'INSERT INTO students (class_id, first_name, last_name, sync_id, sync_op_id) VALUES (?, ?, ?, ?, ?)',
    classId,
    firstName,
    lastName,
    Crypto.randomUUID(), Crypto.randomUUID(),
  );

  notifySchoolDataChanged();
  return { id: result.lastInsertRowId, classId, firstName, lastName };
}

export async function updateStudent(
  id: number,
  input: UpdateStudentInput,
): Promise<Student> {
  requireId(id);
  const firstName = requiredText(input.firstName, 'Meno');
  const lastName = requiredText(input.lastName, 'Priezvisko');
  const db = await getDatabase();
  const student = await db.getFirstAsync<Student>(
    `UPDATE students SET first_name = ?, last_name = ?, sync_dirty=1, sync_op_id=?
     WHERE id = ? AND sync_deleted=0 RETURNING ${STUDENT_COLUMNS}`,
    firstName,
    lastName,
    Crypto.randomUUID(),
    id,
  );

  if (!student) {
    throw new Error('Žiak neexistuje.');
  }

  notifySchoolDataChanged();
  return student;
}

export async function listStudents(classId: number): Promise<Student[]> {
  requireId(classId);
  const db = await getDatabase();

  return db.getAllAsync<Student>(
    `SELECT ${STUDENT_COLUMNS} FROM students
     WHERE class_id = ? AND sync_deleted=0 ORDER BY last_name, first_name, id`,
    classId,
  );
}

export async function deleteStudent(id: number): Promise<void> {
  requireId(id);
  const db = await getDatabase();
  const result = await db.runAsync(
    'UPDATE students SET sync_deleted=1, sync_dirty=1, sync_op_id=? WHERE id=? AND sync_deleted=0',
    Crypto.randomUUID(), id,
  );

  if (result.changes === 0) {
    throw new Error('Žiak neexistuje.');
  }
  // Tombstone the note before the student is removed remotely.
  const note = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM student_notes WHERE student_id=? AND sync_deleted=0', id,
  );
  if (note) await db.runAsync(
    'UPDATE student_notes SET sync_deleted=1,sync_dirty=1,sync_op_id=? WHERE id=?',
    Crypto.randomUUID(), note.id,
  );
  notifySchoolDataChanged();
}

/** Tombstone a class without destroying historic references or local recordings. */
export async function deleteClass(id: number): Promise<void> {
  requireId(id);
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      'UPDATE classes SET sync_deleted=1, sync_dirty=1, sync_op_id=? WHERE id=? AND sync_deleted=0',
      Crypto.randomUUID(), id,
    );
    if (result.changes === 0) throw new Error('Trieda neexistuje.');
    const students = await db.getAllAsync<{ id: number }>(
      'SELECT id FROM students WHERE class_id=? AND sync_deleted=0', id,
    );
    for (const student of students) {
      await db.runAsync('UPDATE students SET sync_deleted=1,sync_dirty=1,sync_op_id=? WHERE id=?',
        Crypto.randomUUID(), student.id);
      const note = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM student_notes WHERE student_id=? AND sync_deleted=0', student.id);
      if (note) await db.runAsync(
        'UPDATE student_notes SET sync_deleted=1,sync_dirty=1,sync_op_id=? WHERE id=?',
        Crypto.randomUUID(), note.id);

    }
  });
  notifySchoolDataChanged();
}
