"""Import future ORM models here so Alembic can discover their tables."""

from app.db.base import Base

__all__ = ["Base"]
