"""Remote Read Analyzer API. Run a single process with persistent data volume."""
import asyncio
import hmac
import os
import wave
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile, status, Request
from fastapi.responses import FileResponse, JSONResponse
from backend.app.schemas import TaskCreated, TaskInfo
from backend.app.sync_schemas import SyncPush
from backend.app.services import store
from backend.app.services.processing import process_job
from backend.app.services.sync import push, pull

MAX_WAV_BYTES = 30 * 1024 * 1024


def authorize(authorization: str | None = Header(default=None)):
    token = os.getenv('RA_API_TOKEN', '')
    if not token or len(token) < 24:
        raise HTTPException(503, 'Server authentication is not configured')
    supplied = authorization[7:] if authorization and authorization.lower().startswith('bearer ') else ''
    if not hmac.compare_digest(supplied, token):
        raise HTTPException(401, 'Invalid bearer token', headers={'WWW-Authenticate': 'Bearer'})


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.initialize()
    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='ra-asr')
    app.state.executor = executor
    # Job rows and audio persist across restarts; safely re-process interrupted tasks.
    for row in store.pending_tasks():
        executor.submit(process_job, row['task_id'])
    yield
    executor.shutdown(wait=False, cancel_futures=True)


app = FastAPI(title='Read Analyzer Remote Analytics', version='1.0.0', lifespan=lifespan)

@app.middleware('http')
async def restrict_api_uploads(request: Request, call_next):
    # Check credential and declared body size before multipart parsing/spooling.
    if request.url.path.startswith('/api/v1/'):
        token = os.getenv('RA_API_TOKEN', '')
        supplied = request.headers.get('authorization', '')
        supplied = supplied[7:] if supplied.lower().startswith('bearer ') else ''
        if not token or len(token) < 24:
            return JSONResponse({'detail': 'Server authentication is not configured'}, status_code=503)
        if not hmac.compare_digest(supplied, token):
            return JSONResponse({'detail': 'Invalid bearer token'}, status_code=401)
        declared = request.headers.get('content-length')
        if declared and declared.isdigit() and int(declared) > MAX_WAV_BYTES + 1024 * 1024:
            return JSONResponse({'detail': 'Request exceeds upload limit'}, status_code=413)
    return await call_next(request)



@app.get('/health')
def health():
    return {'status': 'ok'}


@app.post('/api/v1/sync/push', dependencies=[Depends(authorize)])
def sync_push(body: SyncPush):
    # Class upserts must precede student upserts. Client supplies dependency order.
    return push(body.changes)


@app.get('/api/v1/sync/pull', dependencies=[Depends(authorize)])
def sync_pull(cursor: int = 0, limit: int = 200):
    if cursor < 0 or not (1 <= limit <= 500):
        raise HTTPException(422, 'Invalid cursor or limit')
    return pull(cursor, limit)


@app.post('/api/v1/transcribe', status_code=status.HTTP_202_ACCEPTED,
          response_model=TaskCreated, dependencies=[Depends(authorize)])
async def transcribe_upload(file: UploadFile = File(...), text_code: str = Form(...),
                            student_id: UUID | None = Form(None)):
    if not text_code.strip() or len(text_code) > 100:
        raise HTTPException(422, 'Invalid text_code')
    if student_id is not None:
        with store.connect() as db:
            exists = db.execute('SELECT 1 FROM students WHERE id=? AND deleted=0', (str(student_id),)).fetchone()
        if not exists:
            raise HTTPException(422, 'Student not found on server: sync the student first')
    target = store.AUDIO_DIR / f'{uuid4().hex}.wav'
    size = 0
    try:
        with target.open('wb') as output:
            while block := await file.read(1024 * 1024):
                size += len(block)
                if size > MAX_WAV_BYTES:
                    raise HTTPException(413, 'WAV exceeds 30 MB')
                output.write(block)
        try:
            with wave.open(str(target), 'rb') as wav:
                if wav.getnchannels() != 1 or wav.getsampwidth() != 2 or wav.getframerate() < 16000 or wav.getnframes() == 0 or wav.getcomptype() != 'NONE':
                    raise ValueError('Expected nonempty PCM 16-bit mono WAV >=16 kHz')
                if wav.getnframes() / wav.getframerate() > 20 * 60:
                    raise ValueError('Maximum duration is 20 minutes')
        except (wave.Error, EOFError, ValueError) as exc:
            raise HTTPException(422, f'Invalid WAV: {exc}') from exc
        task_id = store.create_task(target, size, text_code.strip(), str(student_id) if student_id else None)
    except Exception:
        target.unlink(missing_ok=True)
        raise
    finally:
        await file.close()
    app.state.executor.submit(process_job, task_id)
    return {'task_id': task_id, 'status': 'pending'}


@app.get('/api/v1/tasks/{task_id}', response_model=TaskInfo, dependencies=[Depends(authorize)])
def get_task(task_id: str):
    result = store.get_task(task_id)
    if result is None:
        raise HTTPException(404, 'Task not found')
    return result


@app.get('/api/v1/recordings', dependencies=[Depends(authorize)])
def list_recordings(limit: int = 100):
    if not (1 <= limit <= 200):
        raise HTTPException(422, 'Invalid limit')
    return {'recordings': store.list_recordings(limit)}


@app.get('/api/v1/recordings/{recording_id}/download', dependencies=[Depends(authorize)])
def download_recording(recording_id: str):
    try:
        UUID(recording_id)  # Validate identifier before querying metadata.
    except ValueError:
        raise HTTPException(404, 'Recording not found')
    path = store.get_recording_file(recording_id)
    if path is None or not path.is_file():
        raise HTTPException(404, 'Recording not found')
    return FileResponse(path, media_type='audio/wav', filename=f'{recording_id}.wav')
