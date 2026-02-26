from fastapi.testclient import TestClient

from app.main import app
from app.db.mongo import MongoDatabaseAdapter


def test_health_endpoint_returns_ok(monkeypatch):
    monkeypatch.setattr(MongoDatabaseAdapter, "connect", lambda self: None)
    monkeypatch.setattr(MongoDatabaseAdapter, "ping", lambda self: True)
    monkeypatch.setattr(MongoDatabaseAdapter, "close", lambda self: None)

    with TestClient(app) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["database"]["provider"] == "mongodb"
