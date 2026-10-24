import { authorizedHeaders } from './serverAuth';
/** RA-13: transport for the FastAPI contract implemented in step 1. */
import { File, Paths } from 'expo-file-system';
import { copyAsync } from 'expo-file-system/legacy';

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');

export type TaskStatus = 'pending' | 'processing' | 'done' | 'error';

export interface TranscriptionResult {
  transcript: string;
  comparison: Record<string, unknown> | null;
}

export interface TaskInfo {
  task_id: string;
  status: TaskStatus;
  result: TranscriptionResult | null;
  error: string | null;
}

export interface TaskCreated {
  task_id: string;
  status: 'pending';
}

export class ProcessingApiError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'ProcessingApiError';
  }
}

function baseUrl(): string {
  if (!configuredBaseUrl || !/^https?:\/\//i.test(configuredBaseUrl)) {
    throw new ProcessingApiError(
      'Nastavte EXPO_PUBLIC_API_URL vo frontend/.env.local (IP adresa počítača, nie localhost).',
    );
  }
  return configuredBaseUrl;
}

async function fetchTimed(url: string, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ProcessingApiError('Server neodpovedá. Nahrávka zostáva uložená v telefóne.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = '';
    try {
      const body: { detail?: unknown } = await response.json();
      detail = typeof body.detail === 'string' ? body.detail : '';
    } catch { /* The response need not be JSON on network/proxy failures. */ }
    throw new ProcessingApiError(detail || `Server vrátil HTTP ${response.status}`, response.status);
  }
  return response.json() as Promise<T>;
}

/**
 * Android's exportToDownloads() returns a MediaStore content:// URI.
 * Copy to private cache before uploading. This avoids relying on React Native's
 * handling of multipart uploads from content:// and never changes the saved WAV.
 */
export async function submitTranscription(wavUri: string, textCode: string): Promise<TaskCreated> {
  const url = `${baseUrl()}/api/v1/transcribe`;
  const uploadCopy = new File(
    Paths.cache,
    `ra13-upload-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`,
  );

  try {
    await copyAsync({ from: wavUri, to: uploadCopy.uri });
    const form = new FormData();
    form.append('text_code', textCode);
    form.append('file', uploadCopy);
    // Do not set Content-Type: fetch needs to generate the multipart boundary.
    const response = await fetchTimed(url, { method: 'POST', headers: await authorizedHeaders(), body: form }, 90000);
    return await readResponse<TaskCreated>(response);
  } finally {
    // Never delete wavUri: it is the teacher's confirmed Downloads recording.
    try { if (uploadCopy.exists) uploadCopy.delete(); } catch (error) {
      console.warn('Cannot remove temporary upload WAV:', error);
    }
  }
}

export async function fetchTask(taskId: string): Promise<TaskInfo> {
  const response = await fetchTimed(`${baseUrl()}/api/v1/tasks/${encodeURIComponent(taskId)}`, { headers: await authorizedHeaders() });
  return readResponse<TaskInfo>(response);
}
