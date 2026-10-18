export { initializeDatabase } from './database';
export { startRecording, stopRecording } from './recordingService';
export { RECORDING_SAMPLE_RATES, RecordingError } from './types';

export {
  createClass,
  listClasses,
  addStudent,
  updateStudent,
  listStudents,
} from './schoolService';
export type {
  SchoolClass,
  Student,
  AddStudentInput,
  UpdateStudentInput,
} from './types';

export type {
  RecordingSettings,
  RecordingStudent,
  RecordingSampleRate,
  RecordingErrorCode,
} from './types';
