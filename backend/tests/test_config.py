from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy import make_url

from app.core.config import Settings


def test_env_file_and_environment_precedence(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    for name in ("POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_USER", "CORS_ORIGINS"):
        monkeypatch.delenv(name, raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text(
        "POSTGRES_HOST=from-file\nPOSTGRES_USER=reader\n"
        'POSTGRES_PORT=5433\nCORS_ORIGINS=["http://localhost:3000"]\n'
        "BACKEND_PORT=8001\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("POSTGRES_HOST", "db")
    settings = Settings(_env_file=env_file)
    assert settings.postgres_host == "db"
    assert settings.postgres_user == "reader"
    assert settings.postgres_port == 5433
    assert settings.cors_origins == ["http://localhost:3000"]


def test_database_password_with_special_characters() -> None:
    password = "demo@:/%#password"
    settings = Settings(_env_file=None, postgres_password=password)
    url = make_url(settings.database_url.render_as_string(hide_password=False))
    assert url.password == password
    assert url.drivername == "postgresql+psycopg"
    assert password not in repr(settings)


def test_invalid_database_port_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, postgres_port=70000)
