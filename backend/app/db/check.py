"""Run with `python -m app.db.check` to verify a real PostgreSQL connection."""

from sqlalchemy import text

from app.db.session import engine


def main() -> None:
    try:
        with engine.connect() as connection:
            if connection.scalar(text("SELECT 1")) != 1:
                raise RuntimeError("Unexpected database response")
        print("Database connection OK")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
