import { Directory, File, Paths } from 'expo-file-system';

import {
  availableName,
  studentDirectoryName,
} from './naming';

import {
  RecordingError,
  type RecordingSampleRate,
  type RecordingStudent,
} from './types';

export function studentDirectory(student: RecordingStudent): Directory {
  const root = new Directory(Paths.document, 'deti');
  root.create({ intermediates: true, idempotent: true });

  // Reuse the original directory after a name edit in RA-23. Student ID is stable.
  const existing = root.list().filter(
    (entry: File | Directory): entry is Directory => entry instanceof Directory && entry.name.endsWith(`_${student.id}`),
  );
  if (existing.length > 1) {
    throw new Error(`Multiple recording directories exist for student ${student.id}.`);
  }
  if (existing[0]) return existing[0];

  const directory = new Directory(root, studentDirectoryName(student));
  directory.create({ intermediates: true, idempotent: true });
  return directory;
}


// On a fresh launch, remove abandoned previews only. Confirmed .wav files stay intact.
export function removeAbandonedTemporaryWavs(): number {
  const root = new Directory(Paths.document, 'deti');
  if (!root.exists) return 0;

  let removed = 0;
  for (const folder of root.list()) {
    if (!(folder instanceof Directory)) continue;
    for (const entry of folder.list()) {
      // Match only temporary names produced by temporaryFile().
      if (
        entry instanceof File &&
        /^\.\d{4}-\d{2}-\d{2}_[A-Za-z0-9_-]+\.wav\.part$/.test(entry.name)
      ) {
        entry.delete();
        removed += 1;
      }
    }
  }
  return removed;
}

export function temporaryFile(directory: Directory, stem: string): File {
  const names = new Set<string>(directory.list().map((entry: File | Directory) => entry.name));
  const file = new File(directory, availableName(`.${stem}`, '.wav.part', names));
  // Fail on collision; never overwrite an earlier partial recording.
  file.create();
  return file;
}

// This validates the canonical 44-byte PCM header written by our native module.
// It is intentionally not a parser for arbitrary WAV files imported from elsewhere.
export async function validateRecording(file: File, sampleRate: RecordingSampleRate): Promise<void> {
  const invalid = () => new RecordingError('INVALID_WAV', 'The recorded file is not a complete PCM WAV.', file.uri);
  if (!file.exists || file.size <= 44) throw invalid();

  const handle = file.open();
  try {
    const bytes = await handle.readBytes(44);
    if (bytes.length !== 44) throw invalid();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const dataBytes = view.getUint32(40, true);
    if (
      tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || tag(12) !== 'fmt ' || tag(36) !== 'data' ||
      view.getUint32(16, true) !== 16 || view.getUint16(20, true) !== 1 ||
      view.getUint16(22, true) !== 1 || view.getUint32(24, true) !== sampleRate ||
      view.getUint32(28, true) !== sampleRate * 2 || view.getUint16(32, true) !== 2 ||
      view.getUint16(34, true) !== 16 || dataBytes === 0 || dataBytes % 2 !== 0 ||
      dataBytes + 44 !== file.size || view.getUint32(4, true) + 8 !== file.size
    ) throw invalid();
  } finally {
    handle.close();
  }
}
