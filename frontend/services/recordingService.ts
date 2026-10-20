import { PermissionsAndroid, Platform } from 'react-native';
import type { Directory, File } from 'expo-file-system';
import { getWavRecorder } from '../modules/wav-recorder';
import { localDate, normalizeSettings } from './naming';

import {
  removeAbandonedTemporaryWavs,
  studentDirectory,
  temporaryFile,
  validateRecording,
} from './storage';

import {
  RecordingError,
  type RecordingSettings,
} from './types';

interface Session {
  settings: Required<RecordingSettings>;
  directory: Directory;
  file: File;
  stem: string;
  nativeStopped: boolean;
}

let session: Session | null = null;
let pendingRecording: Session | null = null;
let starting: Promise<void> | null = null;
let stopping: Promise<string> | null = null;
let saving: Promise<string> | null = null;

function detail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function begin(settings: Required<RecordingSettings>): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new RecordingError('UNSUPPORTED_PLATFORM', 'WAV recording currently supports Android only.');
  }
  const native = getWavRecorder();
  if (!native) {
    throw new RecordingError('NATIVE_MODULE_MISSING', 'Install a development build containing WavRecorder. Expo Go cannot record with this module.');
  }
  const permission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
  if (!(await PermissionsAndroid.check(permission))) {
    const result = await PermissionsAndroid.request(permission);
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new RecordingError('MICROPHONE_PERMISSION_DENIED', 'Microphone permission was not granted.');
    }
  }

  let file: File | undefined;
  try {
    const directory = studentDirectory(settings.student);
    // Capture the device's local date when recording starts, after the permission dialog.
    const stem = `${localDate(new Date())}_${settings.textId}`;
    file = temporaryFile(directory, stem);
    await native.start(file.uri, settings.sampleRate);
    session = { settings, directory, file, stem, nativeStopped: false };
  } catch (error) {
    // Do not remove any audio if an unexpected native failure left data behind.
    try { if (file?.exists && file.size <= 44) file.delete(); } catch { /* Keep original error. */ }
    throw new RecordingError('START_FAILED', `Could not start recording: ${detail(error)}`, file?.uri);
  }
}

export async function startRecording(settings: RecordingSettings): Promise<void> {
  if (session || starting || stopping || saving) {
    throw new RecordingError('RECORDING_BUSY', 'Finish or save the current recording first.');
  }
  const snapshot = normalizeSettings(settings);
  if (pendingRecording) {
    throw new RecordingError('RECORDING_BUSY', 'Save or discard the temporary recording before starting a new one.');
  }
  starting = begin(snapshot);
  try {
    await starting;
  } finally {
    starting = null;
  }
}

async function finish(): Promise<string> {
  // A quick second tap may arrive while Android is asking for permission.
  if (starting) await starting;
  const current = session;
  if (!current) throw new RecordingError('NOT_RECORDING', 'There is no recording to stop.');

  if (!current.nativeStopped) {
    try {
      await getWavRecorder()!.stop();
      current.nativeStopped = true;
    } catch (error) {
      session = null;
      throw new RecordingError('STOP_FAILED', `Could not finalize recording: ${detail(error)}`, current.file.uri);
    }
    try {
      await validateRecording(current.file, current.settings.sampleRate);
    } catch (error) {
      session = null;
      throw new RecordingError('INVALID_WAV', `WAV validation failed: ${detail(error)}`, current.file.uri);
    }
  }

  // Stopping creates a preview only. The teacher must confirm the final save.
  pendingRecording = current;
  session = null;
  return current.file.uri;
}

export function stopRecording(): Promise<string> {
  // Duplicate stop taps share the result and cannot create duplicate files.
  if (!stopping) {
    stopping = finish().finally(() => { stopping = null; });
  }
  return stopping;
}

// Publish a confirmed WAV to Android Downloads, retaining the preview on export failure.
export function confirmRecordingSave(): Promise<string> {
  if (saving) return saving;
  if (session || starting || stopping) {
    return Promise.reject(new RecordingError('RECORDING_BUSY', 'Finish recording before saving.'));
  }
  const current = pendingRecording;
  if (!current) {
    return Promise.reject(new RecordingError('SAVE_FAILED', 'No pending recording.'));
  }
  const native = getWavRecorder();
  if (!native) {
    return Promise.reject(new RecordingError('NATIVE_MODULE_MISSING', 'An Android development build is required.'));
  }

  saving = (async () => {
    let uri: string;
    try {
      uri = await native.exportToDownloads(current.file.uri, current.directory.name, current.stem);
    } catch (error) {
      // Do not delete the preview: allow retry when the device has free space.
      throw new RecordingError('SAVE_FAILED', `Could not save WAV to Downloads: ${detail(error)}`, current.file.uri);
    }
    pendingRecording = null;
    // Export has succeeded. A failed local cleanup must never trigger a duplicate export.
    try {
      if (current.file.exists) current.file.delete();
    } catch (error) {
      console.warn('The exported WAV is safe, but the temporary copy could not be removed:', error);
    }
    return uri;
  })().finally(() => { saving = null; });
  return saving;
}

// Called only when the teacher explicitly decides to record again.
export function discardPendingRecording(): void {
  if (session || starting || stopping || saving) {
    throw new RecordingError('RECORDING_BUSY', 'Finish the current recording first.');
  }
  if (!pendingRecording) return;

  // Never touch the already-confirmed .wav recordings.
  if (pendingRecording.file.exists) pendingRecording.file.delete();
  pendingRecording = null;
}

// Invoke once when App mounts. Never delete a preview from an active JS session.
export function cleanupAbandonedRecordings(): number {
  if (session || pendingRecording || starting || stopping || saving) return 0;
  return removeAbandonedTemporaryWavs();
}
