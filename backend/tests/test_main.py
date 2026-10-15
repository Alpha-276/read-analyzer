from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.db.session import engine
from app.main import create_app


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    settings = Settings(_env_file=None, cors_origins=["http://localhost:5173"])
    monkeypatch.setattr("app.main.get_settings", lambda: settings)
    with TestClient(create_app()) as test_client:
        yield test_client


def test_root(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["project"] == "Read Analyzer"


def test_health_without_database(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def fail_if_connected(*args: object, **kwargs: object) -> None:
        pytest.fail("The liveness endpoint must not connect to the database")

    monkeypatch.setattr(engine, "connect", fail_if_connected)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_openapi_documents_health(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    assert "200" in response.json()["paths"]["/health"]["get"]["responses"]


@pytest.mark.parametrize(
    ("origin", "expected_status"),
    [("http://localhost:5173", 200), ("https://untrusted.example", 400)],
)
def test_cors_preflight(client: TestClient, origin: str, expected_status: int) -> None:
    response = client.options(
        "/health",
        headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
    )
    assert response.status_code == expected_status
    if expected_status == 200:
        assert response.headers["access-control-allow-origin"] == origin
        assert response.headers["access-control-allow-credentials"] == "true"
    else:
        assert "access-control-allow-origin" not in response.headers
