# Backend Service (Read Analyzer)

FastAPI application scaffold with PostgreSQL, SQLAlchemy 2, psycopg 3,
Alembic, and dependency management through **uv**.

## Project structure

| Path | Responsibility |
| --- | --- |
| `app/main.py` | Application factory, CORS, lifecycle, router registration |
| `app/api/routes/` | HTTP endpoints; `/health` is implemented |
| `app/core/config.py` | Validated environment settings and database URL |
| `app/db/` | Model base, engine, per-request sessions, connection check |
| `app/models/` | Future ORM models and their imports for Alembic |
| `app/services/` | Future business logic and ML integration |
| `alembic/` | Migration environment; no application tables yet |
| `tests/` | API, configuration, and transaction cleanup tests |
| `pyproject.toml`, `uv.lock` | Dependency declarations and exact resolved versions |

## Run everything in Docker

Requires Docker with Compose v2. On Windows, start Docker Desktop with Linux
containers enabled. Run these commands from the **repository root**.

Create `.env` once (do not overwrite your existing configuration):

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# Linux/macOS
cp .env.example .env
```

```bash
docker compose up --build -d --wait
docker compose ps
docker compose logs -f backend
```

`--wait` waits for the PostgreSQL and API health checks. The backend depends on
PostgreSQL becoming healthy. Source changes under `backend/app/` trigger reload;
dependency and migration changes require rebuilding the image. Stop following
logs with Ctrl+C; the containers keep running.

Check HTTP in a second terminal:

```powershell
# Windows: use curl.exe to avoid the Windows PowerShell curl alias.
curl.exe -i http://localhost:8000/health
```

```bash
# Linux/macOS
curl -i http://localhost:8000/health
```

Expected status: **200 OK**. Expected JSON: `{"status":"healthy"}`.
Swagger UI is at <http://localhost:8000/docs>.

Verify the API's actual database connection separately:

```bash
docker compose exec backend python -m app.db.check
```

Expected output: `Database connection OK`. This executes `SELECT 1` through
the application's SQLAlchemy engine and psycopg driver.

Stop the environment with `docker compose down`. PostgreSQL data remains in
the named volume. The `-v` option deletes the volume and its data; use it only
when you intentionally want an empty local database.

## Run Python locally

Use Python 3.12 and uv 0.12.23 or newer. Python 3.11+ is supported by the
dependency declarations; `.python-version` selects 3.12 for normal development.
Install uv using the [official instructions](https://docs.astral.sh/uv/getting-started/installation/).
If Python and pip are already installed, `python -m pip install "uv>=0.12.23"`
is another option. Ensure `uv --version` works in a new terminal.

After creating the root `.env`, start only PostgreSQL from the repository root:

```bash
docker compose up -d --wait db
cd backend
uv sync --locked
uv run --locked uvicorn app.main:app --reload --port 8000
```

If the backend container is already running, run `docker compose stop backend`
before starting local Uvicorn to free port 8000. `uv` creates `.venv` and installs
both runtime and development dependencies; manual activation is unnecessary.
The root and health endpoints also work without a running database.

## Configuration

Use the repository-root `.env`, based on `.env.example`. Environment variables
take priority over this file. `.env` is ignored by Git and excluded from the
Docker image. Example credentials are for local development.

| Variable | Default | Purpose |
| --- | --- | --- |
| `POSTGRES_HOST` | `localhost` | Database host for local Python |
| `POSTGRES_PORT` | `5432` | Database host port for local Python and Compose publishing |
| `POSTGRES_USER` | `postgres` | Database user |
| `POSTGRES_PASSWORD` | `postgres` | Database password |
| `POSTGRES_DB` | `read_analyzer` | Database name |
| `CORS_ORIGINS` | JSON list of localhost/127.0.0.1 on port 5173 | Allowed frontend origins |
| `BACKEND_PORT` | `8000` | Published API port in Compose only |
| `WATCHFILES_FORCE_POLLING` | `true` in Compose | Reload support for Docker Desktop/WSL mounts |

Compose explicitly sets the backend's database host to `db` and its internal
database port to `5432`. Inside a container, `localhost` refers to that container.
Local Python uses the host and port from `.env` instead. The SQLAlchemy URL is
built using `URL.create`, so passwords with URL-reserved characters are handled
without manual encoding. There is no separate `DATABASE_URL` variable to keep
in sync with the PostgreSQL credentials.

Restart the backend after editing `.env`. If you change `BACKEND_PORT`, use that
port in your HTTP requests; local Uvicorn instead uses its explicit `--port`.
PostgreSQL initialization variables apply only to a new data directory. Changing
them does not update users or passwords in an existing database volume.

## Database sessions and migrations

`get_db()` yields a session and closes it after the request. Uncommitted work is
rolled back; write operations must call `session.commit()` explicitly. Use a
regular `def` endpoint for synchronous SQLAlchemy work, so FastAPI runs it in a
thread pool. Do not execute blocking SQL directly inside `async def` endpoints.

Example dependency declaration for a future endpoint:

```python
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.db.session import get_db

DatabaseSession = Annotated[Session, Depends(get_db)]
```

Future models inherit from `app.db.base.Base`. Import each model in
`app/models/__init__.py` so Alembic can discover it. After adding a model, run
from `backend/`, with PostgreSQL running:

```bash
uv run --locked alembic revision --autogenerate -m "create initial tables"
# Review the generated migration before applying it.
uv run --locked alembic upgrade head
```

Commit the migration file with its model. To apply committed migrations through
Docker after rebuilding:

```bash
docker compose up --build -d --wait
docker compose exec backend alembic upgrade head
```

There are no application models or revisions in this scaffold. Migration setup
is ready, but startup deliberately does not create tables. `/health` is a
liveness endpoint and does not certify database readiness. Use the database
check command when demonstrating the database setup.

## Checks

From `backend/`:

```bash
uv sync --locked
uv run --locked pytest -q
uv run --locked ruff check .
uv run --locked ruff format --check .
uv run --locked alembic upgrade head --sql
```

The tests need no PostgreSQL service. Transaction cleanup is exercised with
SQLite in memory; the separate connection check verifies real PostgreSQL.
The Alembic command above validates offline configuration; it does not connect
to PostgreSQL or create tables there. Tests use the current Starlette TestClient
with `httpx2`, installed only in the development dependency group.

## Dependency changes

`requirements.txt` has been replaced by `pyproject.toml` and `uv.lock`.

```bash
uv add package-name
uv add --dev development-package-name
```

Commit both dependency files. `uv sync --locked` rejects an outdated lockfile
instead of silently updating it. The Docker image installs only runtime
dependencies with `uv sync --locked --no-dev`.

## Common startup issues

* **Docker cannot connect to its daemon:** start Docker Desktop first.
* **Port already allocated:** stop the conflicting service or change
  `BACKEND_PORT`/`POSTGRES_PORT` in the root `.env`.
* **Database connection fails:** run `docker compose ps` and
  `docker compose logs db`; check credentials and the existing volume.
* **Changed Python dependency is missing in Docker:** rebuild with
  `docker compose up --build -d --wait`.
* **Source changes are not detected on Windows:** keep
  `WATCHFILES_FORCE_POLLING=true` and verify the `backend/app` bind mount.
