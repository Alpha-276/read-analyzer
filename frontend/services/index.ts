export { initializeDatabase } from './database';
export {
  createClass,
  listClasses,
  addStudent,
  updateStudent,
  deleteStudent,
  listStudents,
} from './schoolService';

export type {
  SchoolClass,
  Student,
  AddStudentInput,
  UpdateStudentInput,
} from './types';

export {
  startRecording,
  stopRecording,
  confirmRecordingSave,
  discardPendingRecording,
  cleanupAbandonedRecordings,
} from './recordingService';

export {
  RecordingError,
} from './types';

export type {
  RecordingSettings,
  RecordingStudent,
  RecordingSampleRate,
  WavRecording,
} from './types';


// RA-13: local saving, remote transcription and persisted processing state.
export { saveRecording, saveAndProcess, resumeRecordingProcessing } from './processingService';
export { getLatestSavedRecording, getSavedRecording, listSavedRecordings } from './recordingRepository';
export type { ProcessingStatus } from './types';
