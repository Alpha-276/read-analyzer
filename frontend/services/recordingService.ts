import { PermissionsAndroid, Platform } from 'react-native';
import type { Directory, File } from 'expo-file-system';
import { getWavRecorder } from '../modules/wav-recorder';
import { localDate, normalizeSettings } from './naming';
import { saveRecording, studentDirectory, temporaryFile, validateRecording } from './storage';
import { RecordingError, type RecordingSettings } from './types';

interface Session {
  settings: Required<RecordingSettings>;
  directory: Directory;
  file: File;
  stem: string;
  nativeStopped: boolean;
}

let session: Session | null = null;
let starting: Promise<void> | null = null;
let stopping: Promise<string> | null = null;

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
  if (session || starting || stopping) {
    throw new RecordingError('RECORDING_BUSY', 'Finish or save the current recording first.');
  }
  const snapshot = normalizeSettings(settings);
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

  try {
    const uri = saveRecording(current.file, current.directory, current.stem);
    session = null;
    return uri;
  } catch (error) {
    // Keep the finished file and session. Calling stopRecording() again retries the move.
    throw new RecordingError('SAVE_FAILED', `Could not save recording: ${detail(error)}`, current.file.uri);
  }
}

export function stopRecording(): Promise<string> {
  // Duplicate stop taps share the result and cannot create duplicate files.
  if (!stopping) {
    stopping = finish().finally(() => { stopping = null; });
  }
  return stopping;
}
