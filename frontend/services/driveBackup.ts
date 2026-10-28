/** Offline-first, opt-in Google Drive archiving; never deletes remote recordings. */
import { getWavRecorder } from '../modules/wav-recorder';
import { studentDirectoryName } from './naming';
import { getDatabase } from './database';
import { activeGoogleAccount } from './googleAuth';
import { createFolder, driveFileUrl, findByKey, putFile, renameIfNeeded, shareWithColleague, withPrivateWavCopy } from './googleDriveApi';
import type { Student } from './types';

export interface DriveConfig { accountEmail: string; folderId: string; automatic: boolean; installationId: string }
interface SavedRecordingRow { id: number; student_id: number; uri: string; text_id: string; saved_at: string; duration_seconds: number }
interface BackupState { file_id: string; fingerprint: string }
export interface BackupProgress { completed: number; total: number; message: string }
let running: Promise<void> | null = null;

export async function getDriveConfig(): Promise<DriveConfig> {
  const db = await getDatabase();
  const cfg = await db.getFirstAsync<{account_email: string; folder_id: string; automatic: number; installation_id: string}>(
    'SELECT account_email, folder_id, automatic, installation_id FROM drive_config WHERE id=1');
  return { accountEmail: cfg?.account_email ?? '', folderId: cfg?.folder_id ?? '', automatic: Boolean(cfg?.automatic), installationId: cfg?.installation_id ?? '' };
}

export async function saveDriveConfig(accountEmail: string, folderId: string, automatic: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE drive_config SET account_email=?,folder_id=?,automatic=? WHERE id=1',
    accountEmail.trim().toLowerCase(), folderId, Number(automatic));
}

export async function setAutomaticDriveBackup(enabled: boolean): Promise<void> {
  const cfg = await getDriveConfig();
  if (!cfg.accountEmail || !cfg.folderId) throw new Error('Najprv vyberte cieľový priečinok Google Drive.');
  await saveDriveConfig(cfg.accountEmail, cfg.folderId, enabled);
}

async function validatedConfig(): Promise<DriveConfig> {
  const cfg = await getDriveConfig();
  if (!cfg.accountEmail || !cfg.folderId) throw new Error('Najprv sa pripojte a vyberte priečinok Google Drive.');
  const loggedIn = await activeGoogleAccount();
  if (loggedIn?.toLowerCase() !== cfg.accountEmail) {
    throw new Error('Pre tento priečinok je nutný pôvodný Google účet.');
  }
  return cfg;
}

async function previous(cfg: DriveConfig, key: string): Promise<BackupState | null> {
  const db = await getDatabase();
  return db.getFirstAsync<BackupState>(
    'SELECT file_id,fingerprint FROM drive_backup_state WHERE account_email=? AND folder_id=? AND source_key=?',
    cfg.accountEmail, cfg.folderId, key);
}
async function remember(cfg: DriveConfig, key: string, fileId: string, fingerprint: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`INSERT INTO drive_backup_state(account_email,folder_id,source_key,file_id,fingerprint)
    VALUES(?,?,?,?,?) ON CONFLICT(account_email,folder_id,source_key)
    DO UPDATE SET file_id=excluded.file_id,fingerprint=excluded.fingerprint`,
    cfg.accountEmail, cfg.folderId, key, fileId, fingerprint);
}

/** Keep the actual teacher-provided class name, removing only path separators / control chars. */
function driveFolderName(name: string): string {
  return name.trim().replace(/[\\/\u0000-\u001f\u007f]/g, '_');
}

async function folderForClass(cfg: DriveConfig, klass: { sync_id: string; name: string }): Promise<string> {
  return createFolder(cfg.accountEmail, cfg.folderId,
    driveFolderName(klass.name), `class-dir:${klass.sync_id}`);
}

async function exportedDetails(uri: string): Promise<{fileName: string; studentFolder: string}> {
  const recorder = getWavRecorder();
  if (!recorder) throw new Error('Na čítanie názvu uloženej nahrávky je potrebná Android zostava aplikácie.');
  return recorder.getExportedInfo(uri);
}

async function folderForStudent(cfg: DriveConfig, classFolder: string,
  student: Student & { sync_id: string }, recordings: SavedRecordingRow[]): Promise<string> {
  // The original Android folder is retained after a student's name is edited.
  // Prefer that exact folder name when a local WAV already exists.
  const name = recordings.length
    ? (await exportedDetails(recordings[0].uri)).studentFolder
    : studentDirectoryName(student);
  return createFolder(cfg.accountEmail, classFolder, name, `student-dir:${student.sync_id}`);
}

async function classesWithIds(classId?: number): Promise<{ id: number; name: string; sync_id: string }[]> {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT id,name,sync_id FROM classes WHERE sync_deleted=0 ${classId == null ? '' : 'AND id=?'} ORDER BY id`,
    ...(classId == null ? [] : [classId]));
}
async function studentIds(classId: number, studentId?: number): Promise<(Student & { sync_id: string })[]> {
  const db = await getDatabase();
  return db.getAllAsync<(Student & { sync_id: string })>(
    `SELECT id,class_id AS classId,first_name AS firstName,last_name AS lastName,sync_id
     FROM students WHERE sync_deleted=0 AND class_id=? ${studentId == null ? '' : 'AND id=?'} ORDER BY id`,
    ...(studentId == null ? [classId] : [classId, studentId]));
}
async function audioRows(studentId: number): Promise<SavedRecordingRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<SavedRecordingRow>(
    'SELECT id, student_id, uri, text_id, saved_at, duration_seconds FROM recordings WHERE student_id=? ORDER BY id', studentId);
}

async function saveWav(cfg: DriveConfig, folder: string, row: SavedRecordingRow): Promise<string> {
  const key = `wav:${cfg.installationId}:${row.id}`;
  // Get the real MediaStore DISPLAY_NAME: includes local capture date and _2 suffixes.
  const {fileName} = await exportedDetails(row.uri);
  const saved = await previous(cfg, key);
  if (saved) {
    await renameIfNeeded(cfg.accountEmail, saved.file_id, fileName);
    return saved.file_id;
  }
  const onDrive = await findByKey(cfg.accountEmail, folder, key);
  if (onDrive) {
    await renameIfNeeded(cfg.accountEmail, onDrive.id, fileName, onDrive.name);
    await remember(cfg, key, onDrive.id, 'uploaded');
    return onDrive.id;
  }
  const id = await withPrivateWavCopy(row.uri, uri =>
    putFile(cfg.accountEmail, folder, key, fileName, uri, 'audio/wav'));
  await remember(cfg, key, id, 'uploaded');
  return id;
}

async function backupClassCore(cfg: DriveConfig, klass: {id: number;name: string;sync_id: string},
  selectedStudent?: number, progress?: (progress: BackupProgress) => void): Promise<void> {
  const students = await studentIds(klass.id, selectedStudent);
  if (selectedStudent != null && !students.length) throw new Error('Žiak neexistuje v tejto triede.');
  const classFolder = await folderForClass(cfg, klass);
  const entries = await Promise.all(students.map(async student => ({ student, recordings: await audioRows(student.id) })));
  const total = entries.reduce((sum, entry) => sum + entry.recordings.length, 0);
  let completed = 0;
  progress?.({ completed, total, message: 'Zálohuje sa trieda a priečinky žiakov' });
  for (const entry of entries) {
    const folder = await folderForStudent(cfg, classFolder, entry.student, entry.recordings);
    for (const recording of entry.recordings) {
      await saveWav(cfg, folder, recording);
      completed += 1;
      progress?.({ completed, total, message: `Nahrávky: ${completed}/${total}` });
    }
  }
}

async function withLock(operation: () => Promise<void>): Promise<void> {
  if (running) return running; // Prevent concurrent manual/automatic bulk transfer.
  const task = operation();
  running = task;
  try { await task; } finally { if (running === task) running = null; }
}

export async function backupClass(classId: number, progress?: (p: BackupProgress) => void): Promise<void> {
  await withLock(async () => {
    const cfg = await validatedConfig();
    const klass = (await classesWithIds(classId))[0];
    if (!klass) throw new Error('Trieda neexistuje.');
    await backupClassCore(cfg, klass, undefined, progress);
  });
}

export async function backupStudent(classId: number, studentId: number, progress?: (p: BackupProgress) => void): Promise<void> {
  await withLock(async () => {
    const cfg = await validatedConfig();
    const klass = (await classesWithIds(classId))[0];
    if (!klass) throw new Error('Trieda neexistuje.');
    await backupClassCore(cfg, klass, studentId, progress);
  });
}

export async function backupAll(progress?: (p: BackupProgress) => void): Promise<void> {
  await withLock(async () => {
    const cfg = await validatedConfig();
    for (const klass of await classesWithIds()) await backupClassCore(cfg, klass, undefined, progress);
  });
}

/** Upload only the selected WAV files, keeping the same class/student folder layout and duplicate protection. */
export async function backupSelectedRecordings(recordingIds: number[], progress?: (p: BackupProgress) => void): Promise<void> {
  const ids = [...new Set(recordingIds)];
  if (!ids.length) return;
  await withLock(async () => {
    const cfg = await validatedConfig();
    const db = await getDatabase();
    const classFolders = new Map<number, string>();
    const studentFolders = new Map<number, string>();
    let completed = 0;
    progress?.({ completed, total: ids.length, message: 'Príprava vybraných nahrávok' });

    for (const id of ids) {
      const row = await db.getFirstAsync<SavedRecordingRow & {
        class_id: number; class_name: string; class_sync_id: string;
        student_sync_id: string; first_name: string; last_name: string;
      }>(`SELECT r.id, r.student_id, r.uri, r.text_id, r.saved_at, r.duration_seconds,
                c.id AS class_id, c.name AS class_name, c.sync_id AS class_sync_id,
                s.sync_id AS student_sync_id, s.first_name, s.last_name
          FROM recordings r
          JOIN students s ON s.id = r.student_id
          JOIN classes c ON c.id = s.class_id
          WHERE r.id = ? AND s.sync_deleted = 0 AND c.sync_deleted = 0`, id);
      if (!row) throw new Error('Vybraná nahrávka alebo jej žiak sa nenašli.');

      let classFolder = classFolders.get(row.class_id);
      if (!classFolder) {
        classFolder = await folderForClass(cfg, { name: row.class_name, sync_id: row.class_sync_id });
        classFolders.set(row.class_id, classFolder);
      }
      let studentFolder = studentFolders.get(row.student_id);
      if (!studentFolder) {
        studentFolder = await folderForStudent(cfg, classFolder, {
          id: row.student_id, classId: row.class_id, firstName: row.first_name,
          lastName: row.last_name, sync_id: row.student_sync_id,
        }, [row]);
        studentFolders.set(row.student_id, studentFolder);
      }
      await saveWav(cfg, studentFolder, row);
      completed += 1;
      progress?.({ completed, total: ids.length, message: 'Zálohovanie vybraných nahrávok' });
    }
  });
}

/** Automatic transfer is opt-in and foreground-only; failures are retried later. */
export async function autoBackupIfEnabled(): Promise<void> {
  const cfg = await getDriveConfig();
  if (!cfg.automatic || !cfg.accountEmail || !cfg.folderId) return;
  await backupAll();
}

export async function shareRecordingById(recordingId: number, recipientEmail: string): Promise<string> {
  const cfg = await validatedConfig();
  const db = await getDatabase();
  const row = await db.getFirstAsync<SavedRecordingRow & { class_id: number }>(
    `SELECT r.id,r.student_id,r.uri,r.text_id,r.saved_at,r.duration_seconds,s.class_id
     FROM recordings r JOIN students s ON s.id=r.student_id
     WHERE r.id=? AND s.sync_deleted=0`, recordingId);
  if (!row) throw new Error('Nahrávka alebo žiak sa nenašli.');
  const klass = (await classesWithIds(row.class_id))[0];
  const student = (await studentIds(row.class_id, row.student_id))[0];
  if (!klass || !student) throw new Error('Trieda alebo žiak neexistuje.');
  const root = await folderForClass(cfg, klass);
  const studentFolder = await folderForStudent(cfg, root, student, [row]);
  const id = await saveWav(cfg, studentFolder, row);
  // Private, named-user access only. Never create an "anyone with the link" grant.
  await shareWithColleague(cfg.accountEmail, id, recipientEmail);
  return driveFileUrl(id);
}

export async function listDriveRecordings(studentId: number): Promise<Array<{id: number; label: string}>> {
  return Promise.all((await audioRows(studentId)).map(async r => ({
    id: r.id, label: (await exportedDetails(r.uri)).fileName,
  })));
}
