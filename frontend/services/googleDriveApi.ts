/** Minimal Google Drive v3 client, including Workspace Shared Drives. */
import { File, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { googleAccessToken, invalidateGoogleToken } from './googleAuth';

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_OPTIONS = 'supportsAllDrives=true';

export interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  capabilities?: { canAddChildren?: boolean };
}

export function driveFolderUrl(id: string): string {
  return `https://drive.google.com/drive/folders/${encodeURIComponent(id)}`;
}
export function driveFileUrl(id: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
}

export function parseFolderId(text: string): string {
  const value = text.trim();
  const match = value.match(/\/folders\/([\w-]+)/) ?? value.match(/[?&]id=([\w-]+)/);
  const id = match ? match[1] : value;
  if (!/^[\w-]{10,}$/.test(id)) {
    throw new Error('Vložte platný odkaz na priečinok Google Drive alebo jeho ID.');
  }
  return id;
}

function describe(status: number, body: string): Error {
  let message = body.slice(0, 300);
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    message = parsed.error?.message ?? message;
  } catch { /* Google may return plain text. */ }
  return new Error(`Google Drive (${status}): ${message || 'Požiadavka zlyhala.'}`);
}

/** Automatically renew a cached Google access token on HTTP 401. */
async function driveFetch(email: string, url: string, init: RequestInit = {}): Promise<Response> {
  const token = await googleAccessToken(email);
  const send = (accessToken: string) => fetch(url, {
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${accessToken}` },
  });
  let response = await send(token);
  if (response.status === 401) {
    await invalidateGoogleToken(token);
    response = await send(await googleAccessToken(email));
  }
  if (!response.ok) throw describe(response.status, await response.text());
  return response;
}

async function driveJson<T>(email: string, url: string, init?: RequestInit): Promise<T> {
  const response = await driveFetch(email, url, init);
  return response.json() as Promise<T>;
}

export async function checkDestination(email: string, folderId: string): Promise<DriveFile> {
  const folder = await driveJson<DriveFile>(email,
    `${API}/${encodeURIComponent(folderId)}?${DRIVE_OPTIONS}&fields=id,name,mimeType,capabilities(canAddChildren)`);
  if (folder.mimeType !== 'application/vnd.google-apps.folder') {
    throw new Error('Vybrané ID nepatrí priečinku Google Drive.');
  }
  if (folder.capabilities?.canAddChildren === false) {
    throw new Error('K tomuto priečinku nemáte povolené nahrávanie súborov.');
  }
  return folder;
}

function safeQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function findByKey(
  email: string, folderId: string, stableKey: string,
): Promise<DriveFile | null> {
  const q = `'${safeQuery(folderId)}' in parents and trashed = false and appProperties has { key = 'ra26_key' and value = '${safeQuery(stableKey)}' }`;
  const params = new URLSearchParams({
    q, fields: 'nextPageToken,files(id,name,mimeType,webViewLink)', pageSize: '10',
    includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives',
  });
  const result = await driveJson<{ files?: DriveFile[] }>(email, `${API}?${params.toString()}`);
  return result.files?.[0] ?? null;
}

/** Rename an existing backed-up item without changing its stable Drive ID. */
export async function renameIfNeeded(email: string, fileId: string, name: string, currentName?: string): Promise<void> {
  const oldName = currentName ?? (await driveJson<DriveFile>(email,
    `${API}/${encodeURIComponent(fileId)}?${DRIVE_OPTIONS}&fields=id,name`)).name;
  if (oldName === name) return;
  await driveJson<DriveFile>(email, `${API}/${encodeURIComponent(fileId)}?${DRIVE_OPTIONS}&fields=id,name`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
  });
}

export async function createFolder(email: string, parentId: string, name: string, stableKey: string): Promise<string> {
  const existing = await findByKey(email, parentId, stableKey);
  if (existing) {
    if (existing.mimeType !== 'application/vnd.google-apps.folder') throw new Error('Na Drive už existuje súbor s týmto ID zálohy.');
    await renameIfNeeded(email, existing.id, name, existing.name);
    return existing.id;
  }
  const folder = await driveJson<DriveFile>(email, `${API}?${DRIVE_OPTIONS}&fields=id,name`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId], appProperties: { ra26_key: stableKey } }),
  });
  return folder.id;
}

/** Use a Drive resumable session, then stream a private local copy as raw bytes. */
export async function putFile(
  email: string, parentId: string, stableKey: string,
  name: string, localUri: string, mimeType: string, previousId?: string,
): Promise<string> {
  const existing = previousId ? { id: previousId } : await findByKey(email, parentId, stableKey);
  const fileId = existing?.id;
  const endpoint = fileId ? `${UPLOAD}/${encodeURIComponent(fileId)}` : UPLOAD;
  const session = await driveFetch(email, `${endpoint}?uploadType=resumable&${DRIVE_OPTIONS}&fields=id,name`, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mimeType },
    body: JSON.stringify(fileId ? { name } : {
      name, mimeType, parents: [parentId], appProperties: { ra26_key: stableKey },
    }),
  });
  const uploadUrl = session.headers.get('Location');
  if (!uploadUrl || !uploadUrl.startsWith('https://')) throw new Error('Google Drive neposkytol URL nahrávania.');
  const token = await googleAccessToken(email);
  const result = await FileSystem.uploadAsync(uploadUrl, localUri, {
    httpMethod: 'PUT', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType },
  });
  if (result.status < 200 || result.status >= 300) throw describe(result.status, result.body);
  const uploaded = JSON.parse(result.body) as { id?: string };
  if (!uploaded.id) throw new Error('Google Drive nevrátil ID nahraného súboru.');
  return uploaded.id;
}

export async function shareWithColleague(email: string, fileId: string, colleagueEmail: string): Promise<void> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(colleagueEmail)) throw new Error('Zadajte platnú e-mailovú adresu kolegu.');
  await driveFetch(email,
    `${API}/${encodeURIComponent(fileId)}/permissions?${DRIVE_OPTIONS}&sendNotificationEmail=true`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'user', role: 'reader', emailAddress: colleagueEmail.trim() }),
    });
}

/** A MediaStore content:// file must first be copied to app cache for uploadAsync. */
export async function withPrivateWavCopy<T>(uri: string, work: (fileUri: string) => Promise<T>): Promise<T> {
  const copy = new File(Paths.cache, `ra26-wav-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
  try {
    await FileSystem.copyAsync({ from: uri, to: copy.uri });
    if (!copy.exists || copy.size <= 44) throw new Error('Pôvodná WAV nahrávka sa nenašla alebo je poškodená.');
    return await work(copy.uri);
  } finally {
    if (copy.exists) copy.delete();
  }
}
