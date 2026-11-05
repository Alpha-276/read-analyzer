/** Server token entered by a teacher, never embedded in the app bundle. */
import * as SecureStore from 'expo-secure-store';
const KEY = 'read_analyzer_remote_api_token';
export async function getServerToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}
export async function saveServerToken(token: string): Promise<void> {
  if (token.trim().length < 24) throw new Error('Prístupový kľúč je príliš krátky.');
  await SecureStore.setItemAsync(KEY, token.trim());
}
export async function clearServerToken(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
export function getServerUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!url || !/^https?:\/\//.test(url)) throw new Error('Nastavte EXPO_PUBLIC_API_URL.');
  return url;
}
export async function authorizedHeaders(): Promise<Record<string, string>> {
  const token = await getServerToken();
  if (!token) throw new Error('Najprv zadajte prístupový kľúč servera.');
  return { Authorization: `Bearer ${token}` };
}
