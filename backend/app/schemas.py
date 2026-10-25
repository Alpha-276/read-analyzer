"""Stable response contract for RA-13 / RA-15."""

from typing import Any, Literal

from pydantic import BaseModel


TaskStatus = Literal["pending", "processing", "done", "error"]


class TaskCreated(BaseModel):
    task_id: str
    status: Literal["pending"] = "pending"


class TranscriptionResult(BaseModel):
    transcript: str
    # RA-11 will provide word-level/other comparison output later.
    comparison: dict[str, Any] | None = None


class TaskInfo(BaseModel):
    task_id: str
    status: TaskStatus
    result: TranscriptionResult | None = None
    error: str | None = None
