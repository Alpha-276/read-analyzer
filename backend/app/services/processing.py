"""Run ASR after the upload response has been sent.

Temporary WAV files are deleted on success and on failure.
Task state is in memory only (one Uvicorn worker, no permanent server data).
"""

import logging
from pathlib import Path
from threading import Lock
from uuid import uuid4

from backend.app.schemas import TaskCreated, TaskInfo, TranscriptionResult
from ml.asr import transcribe

logger = logging.getLogger(__name__)
_jobs: dict[str, TaskInfo] = {}
_jobs_lock = Lock()


def create_job() -> TaskCreated:
    task_id = uuid4().hex
    with _jobs_lock:
        _jobs[task_id] = TaskInfo(task_id=task_id, status="pending")
    return TaskCreated(task_id=task_id)


def get_job(task_id: str) -> TaskInfo | None:
    with _jobs_lock:
        job = _jobs.get(task_id)
        return job.model_copy(deep=True) if job is not None else None


def _update_job(task_id: str, **changes: object) -> None:
    with _jobs_lock:
        job = _jobs[task_id]
        for name, value in changes.items():
            setattr(job, name, value)


def process_job(task_id: str, wav_path: str, text_code: str) -> None:
    """BackgroundTasks entrypoint; text_code is reserved for RA-11."""
    try:
        _update_job(task_id, status="processing")
        transcript = transcribe(wav_path)
        # No comparison is fabricated while the RA-11 module is unavailable.
        _update_job(
            task_id,
            status="done",
            result=TranscriptionResult(transcript=transcript, comparison=None),
        )
    except Exception:
        logger.exception("ASR task %s failed (text_code=%s)", task_id, text_code)
        _update_job(task_id, status="error", error="ASR processing failed")
    finally:
        Path(wav_path).unlink(missing_ok=True)
