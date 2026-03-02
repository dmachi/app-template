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


def test_content_type_admin_authorization(client):
    plain_tokens = register_and_login(client, username="cmsplain", email="cmsplain@example.org")
    super_tokens = register_and_login(client, username="cmssuper", email="cmssuper@example.org")

    auth_store = app.state.auth_store
    super_user = auth_store.authenticate_local_user("cmssuper", "Password123")
    assert super_user is not None
    super_user.roles = ["Superuser"]
    super_tokens = relogin(client, "cmssuper")

    denied = client.post(
        "/api/v1/admin/content/types",
        headers=auth_headers(plain_tokens["accessToken"]),
        json={"key": "article", "label": "Article"},
    )
    assert denied.status_code == 403

    created = client.post(
        "/api/v1/admin/content/types",
        headers=auth_headers(super_tokens["accessToken"]),
        json={"key": "article", "label": "Article"},
    )
    assert created.status_code == 200
    assert created.json()["key"] == "article"


def test_content_create_defaults_to_draft_and_publish_unpublish_flow(client):
    register_and_login(client, username="cmseditor1", email="cmseditor1@example.org")
    auth_store = app.state.auth_store
    editor = auth_store.authenticate_local_user("cmseditor1", "Password123")
    assert editor is not None
    editor.roles = ["ContentAdmin"]
    tokens = relogin(client, "cmseditor1")

    created = client.post(
        "/api/v1/content",
        headers=auth_headers(tokens["accessToken"]),
        json={
            "contentTypeKey": "page",
            "name": "About",
            "content": "Draft content",
            "visibility": "public",
        },
    )
    assert created.status_code == 200
    payload = created.json()
    assert payload["status"] == "draft"
    content_id = payload["id"]

    public_draft = client.get(f"/api/v1/cms/page/{content_id}")
    assert public_draft.status_code == 404

    published = client.post(
        f"/api/v1/content/{content_id}/publish",
        headers=auth_headers(tokens["accessToken"]),
    )
    assert published.status_code == 200
    assert published.json()["status"] == "published"

    public_published = client.get(f"/api/v1/cms/page/{content_id}")
    assert public_published.status_code == 200
    assert public_published.json()["canonicalUrl"] == f"/cms/page/{content_id}"

    unpublished = client.post(
        f"/api/v1/content/{content_id}/unpublish",
        headers=auth_headers(tokens["accessToken"]),
    )
    assert unpublished.status_code == 200
    assert unpublished.json()["status"] == "draft"

    public_after_unpublish = client.get(f"/api/v1/cms/page/{content_id}")
    assert public_after_unpublish.status_code == 404


def test_cms_public_path_requires_matching_content_type(client):
    register_and_login(client, username="cmseditor2", email="cmseditor2@example.org")
    auth_store = app.state.auth_store
    editor = auth_store.authenticate_local_user("cmseditor2", "Password123")
    assert editor is not None
    editor.roles = ["ContentAdmin"]
    tokens = relogin(client, "cmseditor2")

    created = client.post(
        "/api/v1/content",
        headers=auth_headers(tokens["accessToken"]),
        json={
            "contentTypeKey": "page",
            "name": "FAQ",
            "content": "FAQ body",
            "visibility": "public",
        },
    )
    assert created.status_code == 200
    content_id = created.json()["id"]

    published = client.post(
        f"/api/v1/content/{content_id}/publish",
        headers=auth_headers(tokens["accessToken"]),
    )
    assert published.status_code == 200

    matched = client.get(f"/api/v1/cms/page/{content_id}")
    assert matched.status_code == 200
    assert matched.json()["canonicalUrl"] == f"/cms/page/{content_id}"
    assert matched.json()["content"]["id"] == content_id

    missing = client.get(f"/api/v1/cms/article/{content_id}")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "CONTENT_NOT_FOUND"


def test_multiple_content_items_can_share_same_type_and_use_typed_url(client):
    register_and_login(client, username="cmseditor3", email="cmseditor3@example.org")
    auth_store = app.state.auth_store
    editor = auth_store.authenticate_local_user("cmseditor3", "Password123")
    assert editor is not None
    editor.roles = ["ContentAdmin"]
    tokens = relogin(client, "cmseditor3")

    first = client.post(
        "/api/v1/content",
        headers=auth_headers(tokens["accessToken"]),
        json={
            "contentTypeKey": "page",
            "name": "One",
            "content": "Body one",
            "visibility": "public",
        },
    )
    assert first.status_code == 200
    first_id = first.json()["id"]

    second = client.post(
        "/api/v1/content",
        headers=auth_headers(tokens["accessToken"]),
        json={
            "contentTypeKey": "page",
            "name": "Two",
            "content": "Body two",
            "visibility": "public",
        },
    )
    assert second.status_code == 200
    second_id = second.json()["id"]

    published = client.post(
        f"/api/v1/content/{first_id}/publish",
        headers=auth_headers(tokens["accessToken"]),
    )
    assert published.status_code == 200

    published_second = client.post(
        f"/api/v1/content/{second_id}/publish",
        headers=auth_headers(tokens["accessToken"]),
    )
    assert published_second.status_code == 200

    first_public = client.get(f"/api/v1/cms/page/{first_id}")
    assert first_public.status_code == 200
    assert first_public.json()["content"]["id"] == first_id

    second_public = client.get(f"/api/v1/cms/page/{second_id}")
    assert second_public.status_code == 200
    assert second_public.json()["content"]["id"] == second_id


def test_content_patch_without_alias_support(client):
    register_and_login(client, username="cmseditor4", email="cmseditor4@example.org")
    auth_store = app.state.auth_store
    editor = auth_store.authenticate_local_user("cmseditor4", "Password123")
    assert editor is not None
    editor.roles = ["ContentAdmin"]
    tokens = relogin(client, "cmseditor4")

    created = client.post(
        "/api/v1/content",
        headers=auth_headers(tokens["accessToken"]),
        json={
            "contentTypeKey": "page",
            "name": "Patch Target",
            "content": "Body",
            "visibility": "public",
        },
    )
    assert created.status_code == 200
    content_id = created.json()["id"]

    updated = client.patch(
        f"/api/v1/content/{content_id}",
        headers=auth_headers(tokens["accessToken"]),
        json={"name": "Patch Updated"},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Patch Updated"