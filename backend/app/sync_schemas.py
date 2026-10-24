from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field


class SyncChange(BaseModel):
    op_id: UUID
    entity: Literal['class', 'student', 'note']
    id: UUID
    base_version: int = Field(ge=0)
    deleted: bool = False
    name: str | None = Field(default=None, max_length=200)
    class_id: UUID | None = None
    student_id: UUID | None = None
    body: str | None = Field(default=None, max_length=5000)
    first_name: str | None = Field(default=None, max_length=200)
    last_name: str | None = Field(default=None, max_length=200)


class SyncPush(BaseModel):
    changes: list[SyncChange] = Field(max_length=250)
