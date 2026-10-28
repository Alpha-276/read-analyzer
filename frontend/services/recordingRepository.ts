/** Minimal persisted recordings/status layer for RA-13; RA-14 may expand it. */
import { getDatabase } from './database';
import { notifySchoolDataChanged } from './syncEvents';
import type { WavRecording, ProcessingStatus } from './types';

type RecordingRow = {
  student_id: number;
  student_first_name: string;
  student_last_name: string;
  text_id: string;
  uri: string;
  duration_seconds: number;
  processing_status: ProcessingStatus;
  task_id: string | null;
  transcript: string | null;
  comparison_json: string | null;
  error: string | null;
};

function fromRow(row: RecordingRow): WavRecording {
  return {
    uri: row.uri,
    status: 'saved',
    student: {
      id: row.student_id,
      firstName: row.student_first_name,
      lastName: row.student_last_name,
    },
    textId: row.text_id,
    durationSeconds: row.duration_seconds,
    processingStatus: row.processing_status,
    taskId: row.task_id,
    transcript: row.transcript,
    comparison: row.comparison_json ? JSON.parse(row.comparison_json) : null,
    processingError: row.error,
  };
}

/** Called immediately after exporting the WAV, never before. */
export async function persistSavedRecording(recording: WavRecording): Promise<void> {
  if (recording.status !== 'saved') throw new Error('A temporary WAV cannot be persisted as saved.');
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR IGNORE INTO recordings
      (student_id, student_first_name, student_last_name, text_id, uri, duration_seconds)
     VALUES (?, ?, ?, ?, ?, ?)`,
    recording.student.id,
    recording.student.firstName,
    recording.student.lastName,
    recording.textId,
    recording.uri,
    recording.durationSeconds,
  );
  // RA-26 opt-in cloud backup is scheduled only AFTER SQLite has the confirmed WAV.
  notifySchoolDataChanged();
}

export async function updateRecordingProcessing(
  uri: string,
  status: ProcessingStatus,
  options: { taskId?: string | null; transcript?: string | null; comparison?: Record<string, unknown> | null; error?: string | null } = {},
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE recordings SET
       processing_status = ?, task_id = ?, transcript = ?, comparison_json = ?, error = ?
     WHERE uri = ?`,
    status,
    options.taskId ?? null,
    options.transcript ?? null,
    options.comparison == null ? null : JSON.stringify(options.comparison),
    options.error ?? null,
    uri,
  );
}

export async function getSavedRecording(uri: string): Promise<WavRecording | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<RecordingRow>('SELECT * FROM recordings WHERE uri = ?', uri);
  return row ? fromRow(row) : null;
}

/** Latest saved recording is restored after application restart. */
export async function getLatestSavedRecording(): Promise<WavRecording | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<RecordingRow>(
    'SELECT * FROM recordings ORDER BY id DESC LIMIT 1',
  );
  return row ? fromRow(row) : null;
}

/** For the future recording list (RA-10); all saved WAVs can be retried. */
export async function listSavedRecordings(studentId?: number): Promise<WavRecording[]> {
  const db = await getDatabase();
  const rows = studentId === undefined
    ? await db.getAllAsync<RecordingRow>('SELECT * FROM recordings ORDER BY id DESC')
    : await db.getAllAsync<RecordingRow>(
      'SELECT * FROM recordings WHERE student_id = ? ORDER BY id DESC', studentId,
    );
  return rows.map(fromRow);
}
