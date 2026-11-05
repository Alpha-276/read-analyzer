/** In-app signals only; persistence remains in SQLite. */
type Listener = () => void;
const listeners = new Set<Listener>();
export function onSchoolDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function notifySchoolDataChanged(): void {
  for (const listener of listeners) listener();
}
