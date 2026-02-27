from app.main import app
from urllib.parse import unquote
import re


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


def test_admin_users_requires_privileged_role(client):
    tokens = register_and_login(client, username="plainuser", email="plainuser@example.org")

    denied = client.get("/api/v1/admin/users", headers=auth_headers(tokens["accessToken"]))
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "INSUFFICIENT_ROLE"


def test_admin_users_allowed_for_admin_users_role(client):
    register_and_login(client, username="adminusers1", email="adminusers1@example.org")
    register_and_login(client, username="target1", email="target1@example.org")
    register_and_login(client, username="target2", email="target2@example.org")

    auth_store = app.state.auth_store
    admin_users = auth_store.authenticate_local_user("adminusers1", "Password123")
    assert admin_users is not None
    admin_users.roles = ["AdminUsers"]

    manager_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "adminusers1", "password": "Password123"},
    )
    manager_token = manager_login.json()["accessToken"]

    listed = client.get("/api/v1/admin/users", headers=auth_headers(manager_token))
    assert listed.status_code == 200
    assert any(item["username"] == "target1" for item in listed.json()["items"])

    target = auth_store.authenticate_local_user("target1", "Password123")
    assert target is not None
    patched = client.patch(
        f"/api/v1/admin/users/{target.id}",
        headers=auth_headers(manager_token),
        json={"displayName": "Target Updated", "status": "active"},
    )
    assert patched.status_code == 200
    assert patched.json()["displayName"] == "Target Updated"

    patched_email = client.patch(
        f"/api/v1/admin/users/{target.id}",
        headers=auth_headers(manager_token),
        json={"email": "target1+updated@example.org"},
    )
    assert patched_email.status_code == 200
    assert patched_email.json()["email"] == "target1+updated@example.org"
    assert patched_email.json()["emailVerified"] is False

    duplicate_email = client.patch(
        f"/api/v1/admin/users/{target.id}",
        headers=auth_headers(manager_token),
        json={"email": "target2@example.org"},
    )
    assert duplicate_email.status_code == 409
    assert duplicate_email.json()["error"]["code"] == "EMAIL_ALREADY_EXISTS"

    detail = client.get(
        f"/api/v1/admin/users/{target.id}",
        headers=auth_headers(manager_token),
    )
    assert detail.status_code == 200
    assert detail.json()["id"] == target.id
    assert detail.json()["username"] == "target1"
    assert detail.json()["preferences"] == {}
    assert detail.json()["profileProperties"] == {}
    assert isinstance(detail.json()["profilePropertyCatalog"], list)

    reset = client.post(
        f"/api/v1/admin/users/{target.id}/reset-password",
        headers=auth_headers(manager_token),
    )
    assert reset.status_code == 200
    assert reset.json()["success"] is True

    resend_verification = client.post(
        f"/api/v1/admin/users/{target.id}/resend-verification",
        headers=auth_headers(manager_token),
    )
    assert resend_verification.status_code == 200
    assert resend_verification.json()["success"] is True
    assert resend_verification.json()["sent"] is True

    disable = client.patch(
        f"/api/v1/admin/users/{target.id}",
        headers=auth_headers(manager_token),
        json={"status": "disabled"},
    )
    assert disable.status_code == 200
    assert disable.json()["status"] == "disabled"

    disabled_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "target1", "password": "Password123"},
    )
    assert disabled_login.status_code == 401
    assert disabled_login.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_admin_user_groups_endpoint_returns_memberships_with_owner_flag(client):
    owner_tokens = register_and_login(client, username="groupowner_admin", email="groupowner_admin@example.org")
    member_tokens = register_and_login(client, username="groupmember_admin", email="groupmember_admin@example.org")
    admin_tokens = register_and_login(client, username="adminviewer_groups", email="adminviewer_groups@example.org")

    auth_store = app.state.auth_store
    owner = auth_store.authenticate_local_user("groupowner_admin", "Password123")
    member = auth_store.authenticate_local_user("groupmember_admin", "Password123")
    admin_user = auth_store.authenticate_local_user("adminviewer_groups", "Password123")
    assert owner is not None
    assert member is not None
    assert admin_user is not None

    owner.roles = ["GroupManager"]
    admin_user.roles = ["AdminUsers"]

    created_group = client.post(
        "/api/v1/groups",
        headers=auth_headers(owner_tokens["accessToken"]),
        json={"name": "Admin Detail Group", "description": "for admin user groups endpoint"},
    )
    assert created_group.status_code == 200
    group_id = created_group.json()["id"]

    add_member = client.post(
        f"/api/v1/groups/{group_id}/members",
        headers=auth_headers(owner_tokens["accessToken"]),
        json={"usernameOrEmail": "groupmember_admin"},
    )
    assert add_member.status_code == 200

    owner_groups = client.get(
        f"/api/v1/admin/users/{owner.id}/groups",
        headers=auth_headers(admin_tokens["accessToken"]),
    )
    assert owner_groups.status_code == 200
    owner_items = owner_groups.json()["items"]
    assert any(item["id"] == group_id and item["isOwner"] is True for item in owner_items)

    member_groups = client.get(
        f"/api/v1/admin/users/{member.id}/groups",
        headers=auth_headers(admin_tokens["accessToken"]),
    )
    assert member_groups.status_code == 200
    member_items = member_groups.json()["items"]
    assert any(item["id"] == group_id and item["isOwner"] is False for item in member_items)


def test_admin_roles_and_groups_are_restricted(client):
    register_and_login(client, username="manager2", email="manager2@example.org")
    owner_tokens = register_and_login(client, username="groupowner5", email="groupowner5@example.org")

    auth_store = app.state.auth_store
    owner_user = auth_store.authenticate_local_user("groupowner5", "Password123")
    assert owner_user is not None
    owner_user.roles = ["GroupManager"]

    created_group = client.post(
        "/api/v1/groups",
        headers=auth_headers(owner_tokens["accessToken"]),
        json={"name": "Admin Group Target", "description": "to edit"},
    )
    assert created_group.status_code == 200
    group_id = created_group.json()["id"]

    manager = auth_store.authenticate_local_user("manager2", "Password123")
    assert manager is not None
    manager.roles = ["AdminUsers"]

    manager_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "manager2", "password": "Password123"},
    )
    manager_token = manager_login.json()["accessToken"]

    roles_denied = client.get("/api/v1/admin/roles", headers=auth_headers(manager_token))
    assert roles_denied.status_code == 403

    groups_denied = client.get("/api/v1/admin/groups", headers=auth_headers(manager_token))
    assert groups_denied.status_code == 403

    assignable_roles_denied = client.get("/api/v1/admin/groups/assignable-roles", headers=auth_headers(manager_token))
    assert assignable_roles_denied.status_code == 403

    manager.roles = ["AdminGroups"]
    manager_login_as_group_admin = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "manager2", "password": "Password123"},
    )
    manager_group_admin_token = manager_login_as_group_admin.json()["accessToken"]

    groups_allowed = client.get("/api/v1/admin/groups", headers=auth_headers(manager_group_admin_token))
    assert groups_allowed.status_code == 200

    assignable_roles_allowed = client.get("/api/v1/admin/groups/assignable-roles", headers=auth_headers(manager_group_admin_token))
    assert assignable_roles_allowed.status_code == 200
    assert any(item["name"] == "AdminGroups" for item in assignable_roles_allowed.json()["items"])
    assert all(item["name"] != "Superuser" for item in assignable_roles_allowed.json()["items"])

    assign_group_roles = client.put(
        f"/api/v1/admin/groups/{group_id}/roles",
        headers=auth_headers(manager_group_admin_token),
        json={"roles": ["InviteUsers"]},
    )
    assert assign_group_roles.status_code == 200
    assert "InviteUsers" in assign_group_roles.json()["roles"]

    assign_superuser_to_group = client.put(
        f"/api/v1/admin/groups/{group_id}/roles",
        headers=auth_headers(manager_group_admin_token),
        json={"roles": ["Superuser"]},
    )
    assert assign_superuser_to_group.status_code == 400
    assert assign_superuser_to_group.json()["error"]["code"] == "ROLE_NOT_ASSIGNABLE"

    manager.roles = ["Superuser"]
    super_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "manager2", "password": "Password123"},
    )
    super_token = super_login.json()["accessToken"]

    role_create = client.post(
        "/api/v1/admin/roles",
        headers=auth_headers(super_token),
        json={"name": "auditor", "description": "Audit-only operations"},
    )
    assert role_create.status_code == 200
    assert role_create.json()["name"] == "auditor"
    assert role_create.json()["description"] == "Audit-only operations"

    roles_list = client.get("/api/v1/admin/roles", headers=auth_headers(super_token))
    assert roles_list.status_code == 200
    assert any(item["name"] == "auditor" and item["description"] == "Audit-only operations" for item in roles_list.json()["items"])

    role_update = client.patch(
        "/api/v1/admin/roles/auditor",
        headers=auth_headers(super_token),
        json={"description": "Updated auditor description"},
    )
    assert role_update.status_code == 200
    assert role_update.json()["description"] == "Updated auditor description"

    superuser_delete = client.delete("/api/v1/admin/roles/Superuser", headers=auth_headers(super_token))
    assert superuser_delete.status_code == 400
    assert superuser_delete.json()["error"]["code"] == "ROLE_PROTECTED"

    groups_list = client.get("/api/v1/admin/groups", headers=auth_headers(super_token))
    assert groups_list.status_code == 200
    assert any(item["id"] == group_id for item in groups_list.json()["items"])

    group_patch = client.patch(
        f"/api/v1/admin/groups/{group_id}",
        headers=auth_headers(super_token),
        json={"description": "admin updated"},
    )
    assert group_patch.status_code == 200
    assert group_patch.json()["description"] == "admin updated"

    group_delete = client.delete(f"/api/v1/admin/groups/{group_id}", headers=auth_headers(super_token))
    assert group_delete.status_code == 200
    assert group_delete.json()["success"] is True

    role_delete = client.delete("/api/v1/admin/roles/auditor", headers=auth_headers(super_token))
    assert role_delete.status_code == 200
    assert role_delete.json()["success"] is True


def test_admin_invite_adds_existing_users_and_sends_invites_for_new_users(client):
    owner_tokens = register_and_login(client, username="inviteowner", email="inviteowner@example.org")
    existing_tokens = register_and_login(client, username="existinginvitee", email="existinginvitee@example.org")

    auth_store = app.state.auth_store
    owner_for_group = auth_store.authenticate_local_user("inviteowner", "Password123")
    assert owner_for_group is not None
    owner_for_group.roles = ["GroupManager", "InviteUsers"]

    created_group = client.post(
        "/api/v1/groups",
        headers=auth_headers(owner_tokens["accessToken"]),
        json={"name": "Invite Group", "description": "group for invites"},
    )
    assert created_group.status_code == 200
    group_id = created_group.json()["id"]

    owner = auth_store.authenticate_local_user("inviteowner", "Password123")
    assert owner is not None
    owner.roles = ["InviteUsers"]

    owner_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "inviteowner", "password": "Password123"},
    )
    owner_token = owner_login.json()["accessToken"]

    mail_sender = app.state.mail_sender
    outbox_before = len(mail_sender.outbox)

    invite = client.post(
        "/api/v1/admin/users/invitations",
        headers=auth_headers(owner_token),
        json={
            "emails": ["existinginvitee@example.org", "brandnewinvitee@example.org"],
            "groupIds": [group_id],
        },
    )
    assert invite.status_code == 200
    payload = invite.json()
    assert payload["addedExisting"] == 1
    assert payload["invited"] == 1

    outstanding = client.get(
        "/api/v1/admin/users/invitations",
        headers=auth_headers(owner_token),
    )
    assert outstanding.status_code == 200
    assert any(item["invitedEmail"] == "brandnewinvitee@example.org" for item in outstanding.json()["items"])

    existing_user = auth_store.authenticate_local_user("existinginvitee", "Password123")
    assert existing_user is not None
    members = client.get(f"/api/v1/groups/{group_id}/members", headers=auth_headers(owner_tokens["accessToken"]))
    assert members.status_code == 200
    assert any(item["userId"] == existing_user.id for item in members.json()["items"])

    assert len(mail_sender.outbox) == outbox_before + 1
    invite_body = mail_sender.outbox[-1].text_body
    match = re.search(r"token=([^\s]+)", invite_body)
    assert match is not None
    invitation_token = unquote(match.group(1))

    registered = client.post(
        "/api/v1/auth/register",
        json={
            "username": "newinviteacceptor",
            "email": "different.email@example.org",
            "password": "Password123",
            "displayName": "New Invite Acceptor",
        },
    )
    assert registered.status_code == 200
    new_user_tokens = registered.json()
    assert "accessToken" in new_user_tokens

    accepted = client.post(
        "/api/v1/auth/invitations/accept",
        headers=auth_headers(new_user_tokens["accessToken"]),
        json={"token": invitation_token},
    )
    assert accepted.status_code == 200
    assert accepted.json()["success"] is True

    new_user = auth_store.authenticate_local_user("newinviteacceptor", "Password123")
    assert new_user is not None
    members_after_accept = client.get(f"/api/v1/groups/{group_id}/members", headers=auth_headers(owner_tokens["accessToken"]))
    assert members_after_accept.status_code == 200
    assert any(item["userId"] == new_user.id for item in members_after_accept.json()["items"])


def test_admin_invitation_resend_and_revoke(client):
    owner_tokens = register_and_login(client, username="inviteowner2", email="inviteowner2@example.org")

    auth_store = app.state.auth_store
    owner_for_group = auth_store.authenticate_local_user("inviteowner2", "Password123")
    assert owner_for_group is not None
    owner_for_group.roles = ["GroupManager", "InviteUsers"]

    created_group = client.post(
        "/api/v1/groups",
        headers=auth_headers(owner_tokens["accessToken"]),
        json={"name": "Invite Group 2", "description": "group for invite controls"},
    )
    assert created_group.status_code == 200
    group_id = created_group.json()["id"]

    owner = auth_store.authenticate_local_user("inviteowner2", "Password123")
    assert owner is not None
    owner.roles = ["InviteUsers"]

    owner_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "inviteowner2", "password": "Password123"},
    )
    owner_token = owner_login.json()["accessToken"]

    invite = client.post(
        "/api/v1/admin/users/invitations",
        headers=auth_headers(owner_token),
        json={
            "emails": ["resendrevoke@example.org"],
            "groupIds": [group_id],
        },
    )
    assert invite.status_code == 200
    assert invite.json()["invited"] == 1

    outstanding = client.get(
        "/api/v1/admin/users/invitations",
        headers=auth_headers(owner_token),
    )
    assert outstanding.status_code == 200
    invitation_id = outstanding.json()["items"][0]["id"]

    outbox_before_resend = len(app.state.mail_sender.outbox)
    resend = client.post(
        f"/api/v1/admin/users/invitations/{invitation_id}/resend",
        headers=auth_headers(owner_token),
    )
    assert resend.status_code == 200
    assert resend.json()["success"] is True
    assert len(app.state.mail_sender.outbox) == outbox_before_resend + 1

    refreshed = client.get(
        "/api/v1/admin/users/invitations",
        headers=auth_headers(owner_token),
    )
    assert refreshed.status_code == 200
    assert len(refreshed.json()["items"]) == 1
    resent_invitation_id = refreshed.json()["items"][0]["id"]

    revoke = client.delete(
        f"/api/v1/admin/users/invitations/{resent_invitation_id}",
        headers=auth_headers(owner_token),
    )
    assert revoke.status_code == 200
    assert revoke.json()["success"] is True

    after_revoke = client.get(
        "/api/v1/admin/users/invitations",
        headers=auth_headers(owner_token),
    )
    assert after_revoke.status_code == 200
    assert after_revoke.json()["items"] == []


    def test_admin_copy_invitation_link_flow(client):
        owner_tokens = register_and_login(client, username="inviteowner3", email="inviteowner3@example.org")

        auth_store = app.state.auth_store
        owner_for_group = auth_store.authenticate_local_user("inviteowner3", "Password123")
        assert owner_for_group is not None
        owner_for_group.roles = ["GroupManager", "InviteUsers"]

        created_group = client.post(
            "/api/v1/groups",
            headers=auth_headers(owner_tokens["accessToken"]),
            json={"name": "Invite Group 3", "description": "group for invite copy link"},
        )
        assert created_group.status_code == 200
        group_id = created_group.json()["id"]

        owner = auth_store.authenticate_local_user("inviteowner3", "Password123")
        assert owner is not None
        owner.roles = ["InviteUsers"]

        owner_login = client.post(
            "/api/v1/auth/login",
            json={"usernameOrEmail": "inviteowner3", "password": "Password123"},
        )
        owner_token = owner_login.json()["accessToken"]

        invite = client.post(
            "/api/v1/admin/users/invitations",
            headers=auth_headers(owner_token),
            json={
                "emails": ["copylink@example.org"],
                "groupIds": [group_id],
            },
        )
        assert invite.status_code == 200
        assert invite.json()["invited"] == 1

        outstanding = client.get(
            "/api/v1/admin/users/invitations",
            headers=auth_headers(owner_token),
        )
        assert outstanding.status_code == 200
        invitation_id = outstanding.json()["items"][0]["id"]

        outbox_before_copy = len(app.state.mail_sender.outbox)
        copy_link = client.post(
            f"/api/v1/admin/users/invitations/{invitation_id}/copy-link",
            headers=auth_headers(owner_token),
        )
        assert copy_link.status_code == 200
        payload = copy_link.json()
        assert payload["success"] is True
        assert payload["invitation"]["id"] != invitation_id
        assert "token=" in payload["invitationLink"]
        assert len(app.state.mail_sender.outbox) == outbox_before_copy

        refreshed = client.get(
            "/api/v1/admin/users/invitations",
            headers=auth_headers(owner_token),
        )
        assert refreshed.status_code == 200
        assert len(refreshed.json()["items"]) == 1
        assert refreshed.json()["items"][0]["id"] == payload["invitation"]["id"]
