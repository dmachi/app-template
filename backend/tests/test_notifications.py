import re
from datetime import UTC, datetime, timedelta
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


def test_notifications_ack_and_clear_flow(client):
    register_and_login(client, username="notifadmin", email="notifadmin@example.org")
    target_tokens = register_and_login(client, username="notifuser", email="notifuser@example.org")

    auth_store = app.state.auth_store
    admin_user = auth_store.authenticate_local_user("notifadmin", "Password123")
    assert admin_user is not None
    admin_user.roles = ["Superuser"]

    admin_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "notifadmin", "password": "Password123"},
    )
    admin_token = admin_login.json()["accessToken"]

    target_user = auth_store.authenticate_local_user("notifuser", "Password123")
    assert target_user is not None

    created = client.post(
        "/api/v1/notifications",
        headers=auth_headers(admin_token),
        json={
            "userIds": [target_user.id],
            "type": "task.alert",
            "message": "Please review this alert",
            "severity": "warning",
            "requiresAcknowledgement": True,
            "clearanceMode": "ack",
            "source": {"entity_type": "task", "entity_id": "t1", "event_id": "evt-1"},
        },
    )
    assert created.status_code == 200
    assert len(created.json()["created"]) == 1
    notification_id = created.json()["created"][0]["id"]

    my_notifications = client.get("/api/v1/notifications", headers=auth_headers(target_tokens["accessToken"]))
    assert my_notifications.status_code == 200
    assert any(item["id"] == notification_id for item in my_notifications.json()["items"])

    clear_before_ack = client.post(
        f"/api/v1/notifications/{notification_id}/clear",
        headers=auth_headers(target_tokens["accessToken"]),
    )
    assert clear_before_ack.status_code == 400
    assert clear_before_ack.json()["error"]["code"] == "ACK_REQUIRED"

    ack = client.post(
        f"/api/v1/notifications/{notification_id}/acknowledge",
        headers=auth_headers(target_tokens["accessToken"]),
    )
    assert ack.status_code == 200
    assert ack.json()["status"] == "acknowledged"

    cleared = client.post(
        f"/api/v1/notifications/{notification_id}/clear",
        headers=auth_headers(target_tokens["accessToken"]),
    )
    assert cleared.status_code == 200
    assert cleared.json()["status"] == "cleared"


def test_notifications_dedupe_merge(client):
    register_and_login(client, username="mergeadmin", email="mergeadmin@example.org")
    register_and_login(client, username="mergeuser", email="mergeuser@example.org")

    auth_store = app.state.auth_store
    admin_user = auth_store.authenticate_local_user("mergeadmin", "Password123")
    assert admin_user is not None
    admin_user.roles = ["Superuser"]

    admin_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "mergeadmin", "password": "Password123"},
    )
    admin_token = admin_login.json()["accessToken"]

    target_user = auth_store.authenticate_local_user("mergeuser", "Password123")
    assert target_user is not None

    first = client.post(
        "/api/v1/notifications",
        headers=auth_headers(admin_token),
        json={
            "userIds": [target_user.id],
            "type": "pipeline.failed",
            "message": "Pipeline failed",
            "source": {"dedupe_key": "pipeline-1"},
        },
    )
    assert first.status_code == 200
    created_id = first.json()["created"][0]["id"]

    second = client.post(
        "/api/v1/notifications",
        headers=auth_headers(admin_token),
        json={
            "userIds": [target_user.id],
            "type": "pipeline.failed",
            "message": "Pipeline failed again",
            "source": {"dedupe_key": "pipeline-1"},
        },
    )
    assert second.status_code == 200
    assert len(second.json()["merged"]) == 1
    assert second.json()["merged"][0]["id"] == created_id
    assert second.json()["merged"][0]["mergeCount"] == 2


def test_notifications_without_identity_do_not_merge(client):
    register_and_login(client, username="nomergeadmin", email="nomergeadmin@example.org")
    recipient_tokens = register_and_login(client, username="nomergeuser", email="nomergeuser@example.org")

    auth_store = app.state.auth_store
    admin_user = auth_store.authenticate_local_user("nomergeadmin", "Password123")
    assert admin_user is not None
    admin_user.roles = ["Superuser"]

    admin_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "nomergeadmin", "password": "Password123"},
    )
    admin_token = admin_login.json()["accessToken"]

    recipient_user = auth_store.authenticate_local_user("nomergeuser", "Password123")
    assert recipient_user is not None

    first = client.post(
        "/api/v1/notifications",
        headers=auth_headers(admin_token),
        json={
            "userIds": [recipient_user.id],
            "type": "test",
            "message": "test message",
            "requiresAcknowledgement": True,
            "clearanceMode": "ack",
        },
    )
    assert first.status_code == 200
    first_id = first.json()["created"][0]["id"]

    ack = client.post(
        f"/api/v1/notifications/{first_id}/acknowledge",
        headers=auth_headers(recipient_tokens["accessToken"]),
    )
    assert ack.status_code == 200
    assert ack.json()["status"] == "acknowledged"

    second = client.post(
        "/api/v1/notifications",
        headers=auth_headers(admin_token),
        json={
            "userIds": [recipient_user.id],
            "type": "test",
            "message": "test message2",
            "requiresAcknowledgement": True,
            "clearanceMode": "ack",
        },
    )
    assert second.status_code == 200
    assert len(second.json()["merged"]) == 0
    assert len(second.json()["created"]) == 1
    assert second.json()["created"][0]["id"] != first_id
    assert second.json()["created"][0]["status"] == "unread"


def test_notifications_list_defaults_to_unread_only(client):
    recipient_tokens = register_and_login(client, username="filteradmin", email="filteradmin@example.org")

    auth_store = app.state.auth_store
    recipient_user = auth_store.authenticate_local_user("filteradmin", "Password123")
    assert recipient_user is not None
    recipient_user.roles = ["Superuser"]

    admin_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "filteradmin", "password": "Password123"},
    )
    admin_token = admin_login.json()["accessToken"]

    created = client.post(
        "/api/v1/notifications",
        headers=auth_headers(admin_token),
        json={
            "userIds": [recipient_user.id],
            "type": "test",
            "message": "visible unread",
        },
    )
    assert created.status_code == 200
    notification_id = created.json()["created"][0]["id"]

    read = client.post(
        f"/api/v1/notifications/{notification_id}/read",
        headers=auth_headers(recipient_tokens["accessToken"]),
    )
    assert read.status_code == 200

    unread_created = client.post(
        "/api/v1/notifications",
        headers=auth_headers(admin_token),
        json={
            "userIds": [recipient_user.id],
            "type": "test",
            "message": "still unread",
        },
    )
    assert unread_created.status_code == 200
    unread_id = unread_created.json()["created"][0]["id"]

    default_list = client.get(
        "/api/v1/notifications",
        headers=auth_headers(recipient_tokens["accessToken"]),
    )
    assert default_list.status_code == 200
    returned_ids = {item["id"] for item in default_list.json()["items"]}
    assert unread_id in returned_ids
    assert notification_id not in returned_ids


def test_completed_notifications_older_than_24h_are_purged(client):
    recipient_tokens = register_and_login(client, username="purgeadmin", email="purgeadmin@example.org")

    auth_store = app.state.auth_store
    recipient_user = auth_store.authenticate_local_user("purgeadmin", "Password123")
    assert recipient_user is not None
    recipient_user.roles = ["Superuser"]

    admin_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "purgeadmin", "password": "Password123"},
    )
    admin_token = admin_login.json()["accessToken"]

    created = client.post(
        "/api/v1/notifications",
        headers=auth_headers(admin_token),
        json={
            "userIds": [recipient_user.id],
            "type": "test",
            "message": "old completed",
        },
    )
    assert created.status_code == 200
    notification_id = created.json()["created"][0]["id"]

    read = client.post(
        f"/api/v1/notifications/{notification_id}/read",
        headers=auth_headers(recipient_tokens["accessToken"]),
    )
    assert read.status_code == 200

    record = auth_store.get_notification(notification_id)
    assert record is not None
    stale_time = datetime.now(UTC) - timedelta(hours=25)
    record.read_at = stale_time
    record.updated_at = stale_time

    trigger_purge = client.get(
        "/api/v1/notifications",
        headers=auth_headers(recipient_tokens["accessToken"]),
        params={"status": "read", "unreadOnly": "false"},
    )
    assert trigger_purge.status_code == 200

    assert auth_store.get_notification(notification_id) is None


def test_task_gate_completion_check_and_admin_controls(client):
    super_tokens = register_and_login(client, username="notifsuper", email="notifsuper@example.org")
    recipient_tokens = register_and_login(client, username="notifrecipient", email="notifrecipient@example.org")

    auth_store = app.state.auth_store
    super_user = auth_store.authenticate_local_user("notifsuper", "Password123")
    assert super_user is not None
    super_user.roles = ["Superuser"]

    non_super_tokens = register_and_login(client, username="plainnotif", email="plainnotif@example.org")

    super_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "notifsuper", "password": "Password123"},
    )
    super_token = super_login.json()["accessToken"]

    recipient_user = auth_store.authenticate_local_user("notifrecipient", "Password123")
    assert recipient_user is not None

    created = client.post(
        "/api/v1/notifications",
        headers=auth_headers(super_token),
        json={
            "userIds": [recipient_user.id],
            "type": "task.blocked",
            "message": "A task is blocked",
            "clearanceMode": "task_gate",
            "completionCheck": {"function_key": "manual", "arguments": {"completed": False}},
            "source": {"dedupe_key": "task-blocked-1"},
        },
    )
    assert created.status_code == 200
    notification_id = created.json()["created"][0]["id"]

    clear_fail = client.post(
        f"/api/v1/notifications/{notification_id}/clear",
        headers=auth_headers(recipient_tokens["accessToken"]),
    )
    assert clear_fail.status_code == 400
    assert clear_fail.json()["error"]["code"] == "TASK_NOT_COMPLETED"

    check_fail = client.post(
        f"/api/v1/notifications/{notification_id}/check-completion",
        headers=auth_headers(recipient_tokens["accessToken"]),
    )
    assert check_fail.status_code == 200
    assert check_fail.json()["completed"] is False

    merge_update = client.post(
        "/api/v1/notifications",
        headers=auth_headers(super_token),
        json={
            "userIds": [recipient_user.id],
            "type": "task.blocked",
            "message": "A task is now complete",
            "clearanceMode": "task_gate",
            "completionCheck": {"function_key": "manual", "arguments": {"completed": True}},
            "source": {"dedupe_key": "task-blocked-1"},
        },
    )
    assert merge_update.status_code == 200

    check_ok = client.post(
        f"/api/v1/notifications/{notification_id}/check-completion",
        headers=auth_headers(recipient_tokens["accessToken"]),
    )
    assert check_ok.status_code == 200
    assert check_ok.json()["completed"] is True

    clear_ok = client.post(
        f"/api/v1/notifications/{notification_id}/clear",
        headers=auth_headers(recipient_tokens["accessToken"]),
    )
    assert clear_ok.status_code == 200
    assert clear_ok.json()["status"] == "cleared"

    admin_denied = client.get("/api/v1/admin/notifications", headers=auth_headers(non_super_tokens["accessToken"]))
    assert admin_denied.status_code == 403

    admin_list = client.get("/api/v1/admin/notifications", headers=auth_headers(super_token))
    assert admin_list.status_code == 200
    assert any(item["id"] == notification_id for item in admin_list.json()["items"])

    admin_delete = client.delete(f"/api/v1/admin/notifications/{notification_id}", headers=auth_headers(super_token))
    assert admin_delete.status_code == 200
    assert admin_delete.json()["success"] is True
