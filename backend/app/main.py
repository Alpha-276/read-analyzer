"""RA-13: receive WAV, run ASR in the background, return the transcript."""

import os
import tempfile
import wave
from pathlib import Path
from typing import Annotated

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile, status

from backend.app.schemas import TaskCreated, TaskInfo
from backend.app.services.processing import create_job, get_job, process_job

app = FastAPI(title="Read Analyzer ASR", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    # Health reports that the API is running, not that the model has loaded.
    return {"status": "ok"}


@app.post(
    "/api/v1/transcribe",
    response_model=TaskCreated,
    status_code=status.HTTP_202_ACCEPTED,
)
async def submit_transcription(
    background_tasks: BackgroundTasks,
    file: Annotated[UploadFile, File(description="WAV file (PCM 16-bit mono)")],
    text_code: Annotated[str, Form(min_length=1)],
) -> TaskCreated:
    fd, path = tempfile.mkstemp(prefix="read_analyzer_", suffix=".wav")
    try:
        with os.fdopen(fd, "wb") as target:
            while data := await file.read(1024 * 1024):
                target.write(data)

        # Validate the file contents, not its name or Android content:// URI.
        try:
            with wave.open(path, "rb") as wav:
                if (
                    wav.getnchannels() != 1
                    or wav.getsampwidth() != 2
                    or wav.getframerate() < 16_000
                    or wav.getnframes() == 0
                ):
                    raise ValueError("Expected nonempty PCM 16-bit mono WAV (>=16 kHz)")
        except (wave.Error, EOFError, ValueError) as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid WAV file: {exc or 'unsupported or incomplete WAV data'}",
            ) from exc

        job = create_job()
        background_tasks.add_task(process_job, job.task_id, path, text_code)
        return job
    except Exception:
        Path(path).unlink(missing_ok=True)
        raise
    finally:
        await file.close()


@app.get("/api/v1/tasks/{task_id}", response_model=TaskInfo)
def task_status(task_id: str) -> TaskInfo:
    job = get_job(task_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return job
