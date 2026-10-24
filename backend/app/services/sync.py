"""Idempotent optimistic push, ordered incremental pull, deletion tombstones."""
import json
from fastapi import HTTPException
from backend.app.services.store import connect, transaction


def payload(entity, row):
    if entity == 'class':
        return {'name': row['name']}
    return {'class_id': row['class_id'], 'first_name': row['first_name'], 'last_name': row['last_name']}


def _event(db, entity, entity_id, version, deleted, data):
    db.execute('INSERT INTO sync_events(entity, entity_id, version, deleted, data_json) VALUES(?,?,?,?,?)',
               (entity, entity_id, version, int(deleted), json.dumps(data, ensure_ascii=False)))


def push(changes):
    accepted, conflicts = [], []
    with transaction() as db:
        for change in changes:
            entity = change.entity
            entity_id = str(change.id)
            op_id = str(change.op_id)
            old_op = db.execute('SELECT * FROM sync_applied WHERE op_id=?', (op_id,)).fetchone()
            if old_op:
                if old_op['entity'] != entity or old_op['entity_id'] != entity_id:
                    raise HTTPException(409, 'Reused operation ID for another entity')
                accepted.append({'entity': entity, 'id': entity_id, 'op_id': op_id, 'version': old_op['version']})
                continue
            table = 'classes' if entity == 'class' else 'students'
            row = db.execute(f'SELECT * FROM {table} WHERE id=?', (entity_id,)).fetchone()
            current_version = row['version'] if row else 0
            if current_version != change.base_version:
                conflicts.append({'entity': entity, 'id': entity_id, 'op_id': op_id,
                                  'version': current_version, 'deleted': bool(row['deleted']) if row else True,
                                  'data': payload(entity, row) if row else None})
                continue
            if change.deleted:
                if row:
                    db.execute(f'UPDATE {table} SET deleted=1, version=? WHERE id=?',
                               (current_version + 1, entity_id))
                else:
                    # Tombstone for an entity created and deleted entirely offline.
                    if entity == 'class':
                        db.execute('INSERT INTO classes(id,name,version,deleted) VALUES(?,?,?,1)',
                                   (entity_id, '', 1))
                    else:
                        db.execute('INSERT INTO students(id,class_id,first_name,last_name,version,deleted) VALUES(?,?,?,?,?,1)',
                                   (entity_id, '', '', '', 1))
                data = payload(entity, row) if row else {}
            elif entity == 'class':
                if not change.name or not change.name.strip():
                    raise HTTPException(422, 'Class name is required')
                db.execute('''INSERT INTO classes(id,name,version,deleted) VALUES(?,?,?,0)
                         ON CONFLICT(id) DO UPDATE SET name=excluded.name, version=excluded.version, deleted=0''',
                           (entity_id, change.name.strip(), current_version + 1))
                data = {'name': change.name.strip()}
            else:
                parent = db.execute('SELECT 1 FROM classes WHERE id=? AND deleted=0',
                                    (str(change.class_id),)).fetchone()
                if not parent:
                    raise HTTPException(422, f'Parent class {change.class_id} is missing or deleted')
                first, last = (change.first_name or '').strip(), (change.last_name or '').strip()
                if not first or not last:
                    raise HTTPException(422, 'Student first and last name required')
                db.execute('''INSERT INTO students(id,class_id,first_name,last_name,version,deleted)
                          VALUES(?,?,?,?,?,0)
                          ON CONFLICT(id) DO UPDATE SET class_id=excluded.class_id,
                          first_name=excluded.first_name,last_name=excluded.last_name,
                          version=excluded.version,deleted=0''',
                           (entity_id, str(change.class_id), first, last, current_version + 1))
                data = {'class_id': str(change.class_id), 'first_name': first, 'last_name': last}
            version = current_version + 1
            _event(db, entity, entity_id, version, change.deleted, data)
            db.execute('INSERT INTO sync_applied(op_id,entity,entity_id,version) VALUES(?,?,?,?)',
                       (op_id, entity, entity_id, version))
            accepted.append({'entity': entity, 'id': entity_id, 'op_id': op_id, 'version': version})
            if entity == 'class' and change.deleted:
                # A deleted class also tombstones its active students for remote devices.
                students = db.execute('SELECT * FROM students WHERE class_id=? AND deleted=0', (entity_id,)).fetchall()
                for student in students:
                    next_version = student['version'] + 1
                    db.execute('UPDATE students SET deleted=1,version=? WHERE id=?', (next_version, student['id']))
                    _event(db, 'student', student['id'], next_version, True, payload('student', student))
    return {'accepted': accepted, 'conflicts': conflicts}


def pull(cursor: int, limit: int):
    with connect() as db:
        rows = db.execute('''SELECT seq,entity,entity_id,version,deleted,data_json FROM sync_events
                  WHERE seq>? ORDER BY seq LIMIT ?''', (cursor, limit + 1)).fetchall()
    page, has_more = rows[:limit], len(rows) > limit
    return {'changes': [{'seq': r['seq'], 'entity': r['entity'], 'id': r['entity_id'],
                         'version': r['version'], 'deleted': bool(r['deleted']),
                         'data': json.loads(r['data_json'])} for r in page],
            'next_cursor': page[-1]['seq'] if page else cursor, 'has_more': has_more}
