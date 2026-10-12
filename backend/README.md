# Backend Service (Read Analyzer)

Server-side application built with **FastAPI**.

## Project Structure
* `app/api/` — API routes and endpoints
* `app/models/` — Database schemas and ORM models
* `app/services/` — Business logic and ML integration
* `tests/` — Automated test suite (pytest)

## Local Setup
```bash
python -m venv .venv

# Windows:
.venv\Scripts\activate

# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Swagger UI documentation: `http://localhost:8000/docs`
