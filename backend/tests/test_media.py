import re
from urllib.parse import unquote

from app.main import app


def register_and_login(client, username: str, email: str, password: str = "Password123") -> dict:
    register = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
            "displayName": username.title(),
        },
    )
    assert register.status_code == 200

    mail_sender = app.state.mail_sender
    assert hasattr(mail_sender, "outbox")
    assert mail_sender.outbox
    body = mail_sender.outbox[-1].text_body
    match = re.search(r"token=([^\s]+)", body)
    assert match is not None

    verify = client.get("/api/v1/auth/verify-email", params={"token": unquote(match.group(1))})
    assert verify.status_code == 200

    login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": username, "password": password},
    )
    assert login.status_code == 200
    return login.json()


def auth_headers(access_token: str) -> dict:
    return {"Authorization": f"Bearer {access_token}"}


def relogin(client, username: str, password: str = "Password123") -> dict:
    login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": username, "password": password},
    )
    assert login.status_code == 200
    return login.json()


def test_media_upload_requires_editor_or_superuser(client):
    plain_tokens = register_and_login(client, username="mediaplain", email="mediaplain@example.org")

    denied = client.post(
        "/api/v1/media/images",
        headers=auth_headers(plain_tokens["accessToken"]),
        files={"file": ("tiny.png", b"fake-image-bytes", "image/png")},
    )
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "INSUFFICIENT_ROLE"


def test_media_upload_validation_image_only(client):
    register_and_login(client, username="mediaeditor1", email="mediaeditor1@example.org")
    auth_store = app.state.auth_store
    editor = auth_store.authenticate_local_user("mediaeditor1", "Password123")
    assert editor is not None
    editor.roles = ["ContentAdmin"]
    tokens = relogin(client, "mediaeditor1")

    invalid = client.post(
        "/api/v1/media/images",
        headers=auth_headers(tokens["accessToken"]),
        files={"file": ("note.txt", b"hello", "text/plain")},
    )
    assert invalid.status_code == 400
    assert invalid.json()["error"]["code"] == "MEDIA_TYPE_INVALID"


def test_media_upload_list_stream_update_delete_flow(client):
    register_and_login(client, username="mediaeditor2", email="mediaeditor2@example.org")
    auth_store = app.state.auth_store
    editor = auth_store.authenticate_local_user("mediaeditor2", "Password123")
    assert editor is not None
    editor.roles = ["ContentAdmin"]
    tokens = relogin(client, "mediaeditor2")

    uploaded = client.post(
        "/api/v1/media/images",
        headers=auth_headers(tokens["accessToken"]),
        files={"file": ("photo.png", b"\x89PNG\r\n\x1a\n\x00test", "image/png")},
    )
    assert uploaded.status_code == 200
    uploaded_payload = uploaded.json()
    media_id = uploaded_payload["id"]
    assert uploaded_payload["filename"] == "photo.png"
    assert uploaded_payload["contentType"] == "image/png"

    listed = client.get(
        "/api/v1/media/images",
        headers=auth_headers(tokens["accessToken"]),
    )
    assert listed.status_code == 200
    assert any(item["id"] == media_id for item in listed.json()["items"])

    streamed = client.get(f"/api/v1/media/images/{media_id}")
    assert streamed.status_code == 200
    assert streamed.headers["content-type"].startswith("image/png")
    assert streamed.content == b"\x89PNG\r\n\x1a\n\x00test"

    patched = client.patch(
        f"/api/v1/media/images/{media_id}",
        headers=auth_headers(tokens["accessToken"]),
        json={"altText": "Alt sample", "title": "Title sample", "tags": ["hero", "about"]},
    )
    assert patched.status_code == 200
    assert patched.json()["altText"] == "Alt sample"
    assert patched.json()["title"] == "Title sample"
    assert patched.json()["tags"] == ["hero", "about"]

    deleted = client.delete(
        f"/api/v1/media/images/{media_id}",
        headers=auth_headers(tokens["accessToken"]),
    )
    assert deleted.status_code == 200
    assert deleted.json()["success"] is True

    after_delete = client.get(f"/api/v1/media/images/{media_id}")
    assert after_delete.status_code == 404
    assert after_delete.json()["error"]["code"] == "MEDIA_NOT_FOUND"
