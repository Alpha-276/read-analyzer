from contextlib import contextmanager

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.db import session as db


@pytest.mark.parametrize("fail_request", [False, True])
def test_uncommitted_writes_are_rolled_back(
    monkeypatch: pytest.MonkeyPatch, fail_request: bool
) -> None:
    # Exercise transaction cleanup with a real DB connection, without PostgreSQL.
    engine = create_engine("sqlite://")
    monkeypatch.setattr(db, "SessionLocal", sessionmaker(bind=engine))
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE sample (id INTEGER PRIMARY KEY)"))

        def request() -> None:
            with contextmanager(db.get_db)() as session:
                session.execute(text("INSERT INTO sample (id) VALUES (1)"))
                if fail_request:
                    raise RuntimeError("request failed")

        if fail_request:
            with pytest.raises(RuntimeError, match="request failed"):
                request()
        else:
            request()

        with engine.connect() as connection:
            assert connection.scalar(text("SELECT COUNT(*) FROM sample")) == 0
    finally:
        engine.dispose()
