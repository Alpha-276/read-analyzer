export interface SchoolClass {
  id: number;
  name: string;
}

export interface Student {
  id: number;
  classId: number;
  firstName: string;
  lastName: string;
}

export interface AddStudentInput {
  classId: number;
  firstName: string;
  lastName: string;
}

// The class assignment stays unchanged when editing a student's name.
export interface UpdateStudentInput {
  firstName: string;
  lastName: string;
}

// The last recording in the UI, including the preview before confirmation.
export interface WavRecording {
  uri: string;
  student: RecordingStudent;
  textId: string;
  durationSeconds: number;
  status: 'pending' | 'saved';
}

// Stuctures for record logic =============================================

export const RECORDING_SAMPLE_RATES = [16000, 22050, 32000, 44100] as const;

export type RecordingSampleRate = (typeof RECORDING_SAMPLE_RATES)[number];

// Structurally compatible with Student from RA-7
export interface RecordingStudent {
  id: number;
  firstName: string;
  lastName: string;
}

export interface RecordingSettings {
  student: RecordingStudent;
  textId: string;
  //Defaults to 16000 Hz. The output is always mono, signed PCM, 16-bit.
  sampleRate?: RecordingSampleRate;
}

export type RecordingErrorCode =
    | 'INVALID_SETTINGS'
    | 'UNSUPPORTED_PLATFORM'
    | 'NATIVE_MODULE_MISSING'
    | 'MICROPHONE_PERMISSION_DENIED'
    | 'RECORDING_BUSY'
    | 'NOT_RECORDING'
    | 'START_FAILED'
    | 'STOP_FAILED'
    | 'INVALID_WAV'
    | 'SAVE_FAILED';

export class RecordingError extends Error {
  constructor(
      public readonly code: RecordingErrorCode,
      message: string,
      // Retained partial file, if finalization or saving failed. Not a completed recording.
      public readonly temporaryFileUri?: string,
  ) {
    super(message);
    this.name = 'RecordingError';
  }
}
