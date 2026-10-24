/** Incremental two-way class/student sync, with UUID identity and optimistic versions. */
import { getDatabase } from './database';
import { authorizedHeaders, getServerUrl } from './serverAuth';

type Entity = 'class' | 'student';
interface Change {
  entity: Entity; id: string; op_id: string; base_version: number; deleted: boolean;
  name?: string; class_id?: string; first_name?: string; last_name?: string;
}
interface Ack { entity: Entity; id: string; op_id: string; version: number }
interface Conflict { entity: Entity; id: string; op_id: string; version: number }
interface RemoteEvent {
  seq: number; entity: Entity; id: string; version: number; deleted: boolean;
  data: { name?: string; class_id?: string; first_name?: string; last_name?: string };
}

async function authorizedJson<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
  const headers = { ...await authorizedHeaders(), ...(options?.body ? {'Content-Type': 'application/json'} : {}) };
  const response = await fetch(`${getServerUrl()}${path}`, {
    method: options?.method ?? 'GET', headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) throw new Error(`Synchronizácia: HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return response.json() as Promise<T>;
}

async function collectChanges(): Promise<Change[]> {
  const db = await getDatabase();
  const classes = await db.getAllAsync<{
    sync_id: string; sync_op_id: string; server_version: number; sync_deleted: number; name: string;
  }>('SELECT sync_id,sync_op_id,server_version,sync_deleted,name FROM classes WHERE sync_dirty=1');
  const students = await db.getAllAsync<{
    sync_id: string; sync_op_id: string; server_version: number; sync_deleted: number;
    first_name: string; last_name: string; class_sync_id: string;
  }>(`SELECT s.sync_id,s.sync_op_id,s.server_version,s.sync_deleted,
     s.first_name,s.last_name,c.sync_id AS class_sync_id
     FROM students s JOIN classes c ON c.id=s.class_id WHERE s.sync_dirty=1`);
  const c: Change[] = classes.map(x => ({ entity:'class', id:x.sync_id, op_id:x.sync_op_id,
    base_version:x.server_version, deleted: Boolean(x.sync_deleted), name:x.name }));
  const s: Change[] = students.map(x => ({ entity:'student', id:x.sync_id, op_id:x.sync_op_id,
    base_version:x.server_version, deleted:Boolean(x.sync_deleted), class_id:x.class_sync_id,
    first_name:x.first_name, last_name:x.last_name }));
  return [ ...c.filter(x=>!x.deleted), ...s.filter(x=>!x.deleted),
           ...s.filter(x=>x.deleted), ...c.filter(x=>x.deleted) ];
}

async function applyAck(ack: Ack): Promise<void> {
  const db = await getDatabase();
  const table = ack.entity === 'class' ? 'classes' : 'students';
  await db.runAsync(`UPDATE ${table} SET server_version=MAX(server_version,?),
     sync_dirty=CASE WHEN sync_op_id=? THEN 0 ELSE sync_dirty END WHERE sync_id=?`,
    ack.version, ack.op_id, ack.id);
}

async function applyEvent(event: RemoteEvent): Promise<void> {
  const db = await getDatabase();
  if (event.entity === 'class') {
    const row = await db.getFirstAsync<{ id:number;sync_dirty:number;server_version:number }>(
      'SELECT id,sync_dirty,server_version FROM classes WHERE sync_id=?', event.id);
    if (row) {
      if (!row.sync_dirty && event.version > row.server_version) {
        await db.runAsync('UPDATE classes SET name=?,sync_deleted=?,server_version=? WHERE id=?',
          event.data.name ?? '', Number(event.deleted), event.version, row.id);
      }
    } else if (event.data.name) {
      await db.runAsync(`INSERT INTO classes(name,sync_id,sync_dirty,sync_deleted,server_version)
          VALUES(?,?,0,?,?)`, event.data.name, event.id, Number(event.deleted), event.version);
    }
  } else {
    const row = await db.getFirstAsync<{ id:number;sync_dirty:number;server_version:number }>(
      'SELECT id,sync_dirty,server_version FROM students WHERE sync_id=?', event.id);
    if (row?.sync_dirty) return;
    if (row && event.version <= row.server_version) return;
    // Deletion with empty payload needs no local record to tombstone.
    if (!event.data.class_id) {
      if (row) await db.runAsync('UPDATE students SET sync_deleted=1,server_version=? WHERE id=?', event.version, row.id);
      return;
    }
    const parent = await db.getFirstAsync<{id:number}>(
      'SELECT id FROM classes WHERE sync_id=?', event.data.class_id);
    if (!parent) throw new Error('Missing parent class in sync page; do not advance cursor.');
    if (row) {
      await db.runAsync(`UPDATE students SET class_id=?,first_name=?,last_name=?,
                sync_deleted=?,server_version=? WHERE id=?`, parent.id,
        event.data.first_name ?? '', event.data.last_name ?? '', Number(event.deleted),event.version,row.id);
    } else {
      await db.runAsync(`INSERT INTO students(class_id,first_name,last_name,sync_id,sync_dirty,sync_deleted,server_version)
                   VALUES(?,?,?,?,0,?,?)`, parent.id,
        event.data.first_name ?? '', event.data.last_name ?? '', event.id, Number(event.deleted),event.version);
    }
  }
}

let currentSync: Promise<void> | undefined;
export function synchronizeSchool(): Promise<void> {
  if (!currentSync) currentSync = synchronizeInner().finally(() => { currentSync = undefined; });
  return currentSync;
}
async function synchronizeInner(): Promise<void> {
  // Push current local edits; never discard conflicting local data.
  const changes = await collectChanges();
  for (let i=0; i<changes.length; i+=100) {
    const response = await authorizedJson<{accepted:Ack[];conflicts:Conflict[]}>(
      '/api/v1/sync/push', {method:'POST',body:{changes:changes.slice(i,i+100)}});
    for (const ack of response.accepted) await applyAck(ack);
    if (response.conflicts.length) {
      throw new Error(`Konflikt synchronizácie (${response.conflicts.map(x=>x.entity+': '+x.id).join(', ')}). Lokálne zmeny zostali zachované.`);
    }
  }
  // Pull remote edits incrementally, atomically committing each page and its cursor.
  const db = await getDatabase();
  let cursor = (await db.getFirstAsync<{cursor:number}>('SELECT cursor FROM school_sync_state WHERE id=1'))?.cursor ?? 0;
  for (let page=0; page<1000; page++) {
    const incoming = await authorizedJson<{changes:RemoteEvent[];next_cursor:number;has_more:boolean}>(
      `/api/v1/sync/pull?cursor=${cursor}&limit=200`);
    await db.withTransactionAsync(async () => {
      for (const event of incoming.changes) await applyEvent(event);
      await db.runAsync('UPDATE school_sync_state SET cursor=? WHERE id=1',incoming.next_cursor);
    });
    cursor = incoming.next_cursor;
    if (!incoming.has_more) return;
  }
  throw new Error('Sync requires too many pages; repeat synchronization.');
}
