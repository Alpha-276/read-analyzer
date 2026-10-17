import { getDatabase } from './database';
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
    'INSERT INTO classes (name) VALUES (?)',
    trimmedName,
  );

  return { id: result.lastInsertRowId, name: trimmedName };
}

export async function listClasses(): Promise<SchoolClass[]> {
  const db = await getDatabase();

  return db.getAllAsync<SchoolClass>(
    'SELECT id, name FROM classes ORDER BY name, id',
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
    'INSERT INTO students (class_id, first_name, last_name) VALUES (?, ?, ?)',
    classId,
    firstName,
    lastName,
  );

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
    `UPDATE students SET first_name = ?, last_name = ?
     WHERE id = ? RETURNING ${STUDENT_COLUMNS}`,
    firstName,
    lastName,
    id,
  );

  if (!student) {
    throw new Error('Žiak neexistuje.');
  }

  return student;
}

export async function listStudents(classId: number): Promise<Student[]> {
  requireId(classId);
  const db = await getDatabase();

  return db.getAllAsync<Student>(
    `SELECT ${STUDENT_COLUMNS} FROM students
     WHERE class_id = ? ORDER BY last_name, first_name, id`,
    classId,
  );
}
