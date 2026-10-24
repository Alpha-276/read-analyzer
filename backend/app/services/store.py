"""Single-instance durable storage for the remote analysis server (SQLite + WAV directory)."""
import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4

DATA_DIR = Path(os.getenv('RA_DATA_DIR', './server-data')).resolve()
AUDIO_DIR = DATA_DIR / 'recordings'
DB_PATH = DATA_DIR / 'server.sqlite3'
_LOCK = threading.RLock()


def connect():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(str(DB_PATH), timeout=30)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    db.execute('PRAGMA busy_timeout=30000')
    return db


@contextmanager
def transaction():
    with _LOCK:
        with connect() as db:
            db.execute('BEGIN IMMEDIATE')
            yield db


def initialize():
    # WAL allows reads while one ASR or sync operation is committing.
    with connect() as db:
        db.execute('PRAGMA journal_mode=WAL')
    with transaction() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS classes (
            id TEXT PRIMARY KEY, name TEXT NOT NULL,
            version INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY, class_id TEXT NOT NULL, first_name TEXT NOT NULL,
            last_name TEXT NOT NULL, version INTEGER NOT NULL,
            deleted INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS student_notes (
            id TEXT PRIMARY KEY, student_id TEXT NOT NULL UNIQUE,
            body TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL,
            deleted INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS sync_events (
            seq INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT NOT NULL,
            entity_id TEXT NOT NULL, version INTEGER NOT NULL,
            deleted INTEGER NOT NULL, data_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sync_applied (
            op_id TEXT PRIMARY KEY, entity TEXT NOT NULL,
            entity_id TEXT NOT NULL, version INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS recordings (
            id TEXT PRIMARY KEY, student_id TEXT, text_code TEXT NOT NULL,
            file_path TEXT NOT NULL, file_size INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            recording_id TEXT NOT NULL REFERENCES recordings(id),
            status TEXT NOT NULL, transcript TEXT,
            comparison_json TEXT, error TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_sync_events_seq ON sync_events(seq);
        CREATE INDEX IF NOT EXISTS idx_recordings_student ON recordings(student_id);
        ''')


def create_task(file_path: Path, size: int, text_code: str, student_id: str | None):
    recording_id, task_id = uuid4().hex, uuid4().hex
    with transaction() as db:
        db.execute('INSERT INTO recordings(id,student_id,text_code,file_path,file_size) VALUES(?,?,?,?,?)',
                   (recording_id, student_id, text_code, str(file_path), size))
        db.execute("INSERT INTO tasks(id,recording_id,status) VALUES(?,?,'pending')",
                   (task_id, recording_id))
    return task_id


def get_task(task_id: str):
    with connect() as db:
        r = db.execute('SELECT * FROM tasks WHERE id=?', (task_id,)).fetchone()
    if not r:
        return None
    result = None if r['transcript'] is None else {
        'transcript': r['transcript'],
        'comparison': json.loads(r['comparison_json']) if r['comparison_json'] else None
    }
    return {'task_id': r['id'], 'status': r['status'], 'result': result, 'error': r['error']}


def update_task(task_id: str, status: str, transcript: str | None = None, error: str | None = None):
    with transaction() as db:
        db.execute('''UPDATE tasks SET status=?, transcript=?, error=?, updated_at=CURRENT_TIMESTAMP
                      WHERE id=?''', (status, transcript, error, task_id))


def pending_tasks():
    with connect() as db:
        return [dict(row) for row in db.execute('''SELECT t.id AS task_id, r.file_path
            FROM tasks t JOIN recordings r ON r.id=t.recording_id
            WHERE t.status IN ('pending', 'processing') ORDER BY t.created_at''')]


def task_file(task_id: str):
    with connect() as db:
        row = db.execute('''SELECT r.file_path FROM tasks t
                JOIN recordings r ON r.id=t.recording_id WHERE t.id=?''', (task_id,)).fetchone()
    return Path(row['file_path']) if row else None


def get_recording_file(recording_id: str):
    with connect() as db:
        row = db.execute('SELECT file_path FROM recordings WHERE id=?', (recording_id,)).fetchone()
    return Path(row['file_path']) if row else None


def list_recordings(limit: int = 100):
    with connect() as db:
        return [dict(r) for r in db.execute('''SELECT r.id, r.student_id, r.text_code, r.file_size,
          r.created_at, t.id AS task_id, t.status, t.transcript, t.error
          FROM recordings r JOIN tasks t ON t.recording_id=r.id
          ORDER BY r.created_at DESC LIMIT ?''', (limit,))]
