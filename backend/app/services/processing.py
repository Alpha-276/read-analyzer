"""Durable job statuses and recordings; one CPU/GPU ASR executor per server instance."""
import logging
from backend.app.services import store
from ml.asr import transcribe

log = logging.getLogger(__name__)


def process_job(task_id: str):
    path = store.task_file(task_id)
    if path is None or not path.is_file():
        store.update_task(task_id, 'error', error='Stored WAV is unavailable')
        return
    try:
        store.update_task(task_id, 'processing')
        transcript = transcribe(path)
        if not transcript or not transcript.strip():
            store.update_task(task_id, 'error', error='ASR did not recognize any speech')
        else:
            store.update_task(task_id, 'done', transcript=transcript.strip())
    except Exception:
        log.exception('ASR failed for task %s', task_id)
        store.update_task(task_id, 'error', error='ASR processing failed')
    # Intentionally retain WAV permanently on server under restricted RA_DATA_DIR.
