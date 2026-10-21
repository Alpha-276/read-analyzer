/** RA-13: local WAV confirmation, ASR processing and recovery after interruption. */
import { fetchTask, ProcessingApiError, submitTranscription, type TaskInfo } from './api';
import { confirmRecordingSave } from './recordingService';
import {
  getSavedRecording,
  persistSavedRecording,
  updateRecordingProcessing,
} from './recordingRepository';
import type { ProcessingStatus, WavRecording } from './types';

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 150; // About five minutes. The task ID remains saved for later recovery.

type OnChange = (recording: WavRecording) => void;

class AsrTaskError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AsrTaskError';
  }
}

function detail(error: unknown): string {
  if (error instanceof ProcessingApiError || error instanceof AsrTaskError) return error.message;
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return 'Nedá sa pripojiť k serveru. Skontrolujte pripojenie a skúste to znova.';
  }
  return error instanceof Error ? error.message : String(error);
}

function next(recording: WavRecording, status: ProcessingStatus, patch: Partial<WavRecording> = {}): WavRecording {
  return { ...recording, processingStatus: status, ...patch };
}

async function update(
  recording: WavRecording,
  status: ProcessingStatus,
  patch: Partial<WavRecording>,
  onChange?: OnChange,
): Promise<WavRecording> {
  const updated = next(recording, status, patch);
  await updateRecordingProcessing(updated.uri, status, {
    taskId: updated.taskId,
    transcript: updated.transcript,
    comparison: updated.comparison,
    error: updated.processingError,
  });
  onChange?.(updated);
  return updated;
}

/** Only local save; confirmed WAV is never exported again for retries. */
export async function saveRecording(recording: WavRecording, onChange?: OnChange): Promise<WavRecording> {
  const saved: WavRecording = recording.status === 'saved'
    ? recording
    : {
      ...recording,
      uri: await confirmRecordingSave(),
      status: 'saved',
      processingStatus: 'unprocessed',
      taskId: null,
      transcript: null,
      comparison: null,
      processingError: null,
    };

  // Notify UI immediately: native export to Downloads cannot be rolled back.
  onChange?.(saved);
  await persistSavedRecording(saved);
  return (await getSavedRecording(saved.uri)) ?? saved;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Poll an existing server job. This NEVER uploads audio. */
async function poll(recording: WavRecording, taskId: string, onChange?: OnChange): Promise<WavRecording> {
  let current = recording;

  for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
    const response: TaskInfo = await fetchTask(taskId);

    if (response.status === 'done') {
      if (!response.result || typeof response.result.transcript !== 'string') {
        throw new AsrTaskError('Server nevrátil prepis nahrávky.');
      }
      return update(current, 'done', {
        transcript: response.result.transcript,
        comparison: response.result.comparison,
        taskId,
        processingError: null,
      }, onChange);
    }

    if (response.status === 'error') {
      throw new AsrTaskError(response.error || 'ASR spracovanie zlyhalo.');
    }

    if (current.processingStatus !== response.status || current.taskId !== taskId || current.processingError) {
      current = await update(current, response.status, { taskId, processingError: null }, onChange);
    }
    await sleep(POLL_INTERVAL_MS);
  }

  // Preserve taskId. The user can retry polling without uploading the file again.
  throw new Error('Spracovanie trvá príliš dlho. Skúste skontrolovať výsledok znova.');
}

/** Keep the confirmed WAV and persist an actionable status for all failures. */
async function preserveFailure(
  recording: WavRecording,
  error: unknown,
  onChange?: OnChange,
): Promise<WavRecording> {
  const missingJob = error instanceof ProcessingApiError && error.statusCode === 404;
  const failedAsr = error instanceof AsrTaskError;
  const message = missingJob
    ? 'Úloha na serveri už neexistuje. Nahrávku môžete odoslať znova.'
    : detail(error);
  const status: ProcessingStatus = failedAsr ? 'error' : 'unprocessed';
  const patch: Partial<WavRecording> = {
    // A terminal server failure or lost job must NOT be polled again.
    // For connection failures, retain taskId: the server may still be working.
    taskId: missingJob || failedAsr ? null : recording.taskId ?? null,
    processingError: message,
  };

  try {
    return await update(recording, status, patch, onChange);
  } catch (dbError) {
    console.warn('Cannot persist ASR failure:', dbError);
    const fallback = next(recording, status, patch);
    onChange?.(fallback);
    return fallback;
  }
}

/**
 * Save before uploading. Retry first checks a known taskId; only missing or
 * terminally failed server tasks cause a new upload after explicit user action.
 */
export async function saveAndProcess(recording: WavRecording, onChange?: OnChange): Promise<WavRecording> {
  let current = await saveRecording(recording, onChange);
  if (current.processingStatus === 'done') return current;

  try {
    if (current.taskId) {
      try {
        return await poll(current, current.taskId, onChange);
      } catch (error) {
        const missingJob = error instanceof ProcessingApiError && error.statusCode === 404;
        if (!missingJob && !(error instanceof AsrTaskError)) throw error;
        // Explicit retry: an old task was lost or failed, submit a fresh one.
        current = await update(current, 'unprocessed', {
          taskId: null,
          processingError: null,
        }, onChange);
      }
    }

    current = await update(current, 'pending', {
      taskId: null,
      processingError: null,
    }, onChange);
    const created = await submitTranscription(current.uri, current.textId);
    current = await update(current, 'pending', {
      taskId: created.task_id,
    }, onChange);
    return await poll(current, created.task_id, onChange);
  } catch (error) {
    await preserveFailure(current, error, onChange);
    throw error;
  }
}

/**
 * On app launch, resume polling an existing server task. Does not upload WAV.
 * A lost task becomes 'unprocessed', enabling a manual retry from Downloads.
 */
export async function resumeRecordingProcessing(
  recording: WavRecording,
  onChange?: OnChange,
): Promise<WavRecording> {
  if (recording.status !== 'saved' || !recording.taskId || recording.processingStatus === 'done') {
    return recording;
  }

  try {
    return await poll(recording, recording.taskId, onChange);
  } catch (error) {
    return preserveFailure(recording, error, onChange);
  }
}
