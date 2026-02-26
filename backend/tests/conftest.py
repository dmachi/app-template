import os

import pytest
from fastapi.testclient import TestClient

from app.db.mongo import MongoDatabaseAdapter

os.environ["APP_ENV"] = "test"
os.environ.setdefault("JWT_ACCESS_TOKEN_SECRET", "test-access-secret-32-bytes-minimum")
os.environ.setdefault("JWT_REFRESH_TOKEN_SECRET", "test-refresh-secret-32-bytes-minimum")

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
