import {
  RECORDING_SAMPLE_RATES,
  RecordingError,
  type RecordingSampleRate,
  type RecordingSettings,
  type RecordingStudent,
} from './types';

export function normalizeSettings(settings: RecordingSettings): Required<RecordingSettings> {
  const student = settings?.student;
  const firstName = typeof student?.firstName === 'string' ? student.firstName.trim() : '';
  const lastName = typeof student?.lastName === 'string' ? student.lastName.trim() : '';
  const textId = typeof settings?.textId === 'string' ? settings.textId.trim() : '';
  const sampleRate = settings?.sampleRate ?? 16000;

  if (
    !Number.isSafeInteger(student?.id) || student.id <= 0 || !firstName || !lastName ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(textId) ||
    !RECORDING_SAMPLE_RATES.includes(sampleRate as RecordingSampleRate)
  ) {
    throw new RecordingError('INVALID_SETTINGS', 'Invalid student, text code or sample rate.');
  }

  // Snapshot the input so a screen cannot change the destination during recording.
  return { student: { id: student.id, firstName, lastName }, textId, sampleRate };
}

function safeName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9-]/g, '').slice(0, 60) || 'ziak';
}

export function studentDirectoryName(student: RecordingStudent): string {
  return `${safeName(student.firstName)}_${safeName(student.lastName)}_${student.id}`;
}

export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function availableName(stem: string, extension: string, names: Set<string>): string {
  let suffix = 1;
  let name = `${stem}${extension}`;
  while (names.has(name)) {
    suffix += 1;
    name = `${stem}_${suffix}${extension}`;
  }
  return name;
}
