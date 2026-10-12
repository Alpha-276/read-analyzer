# Backend Service (Read Analyzer)

Серверная часть приложения построена на **FastAPI**.

## Структура
* `app/api/` — маршруты и эндпоинты API
* `app/models/` — схемы базы данных
* `app/services/` — логика обработки и интеграция с ML
* `tests/` — автотесты pytest

## Локальный запуск
```bash
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Swagger UI: `http://localhost:8000/docs`
