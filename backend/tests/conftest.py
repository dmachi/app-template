import pytest
from fastapi.testclient import TestClient

from app.db.mongo import MongoDatabaseAdapter
from app.main import app


@pytest.fixture(autouse=True)
def patch_mongo(monkeypatch):
    monkeypatch.setattr(MongoDatabaseAdapter, "connect", lambda self: None)
    monkeypatch.setattr(MongoDatabaseAdapter, "ping", lambda self: True)
    monkeypatch.setattr(MongoDatabaseAdapter, "close", lambda self: None)


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client
