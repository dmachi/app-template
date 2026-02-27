from app.main import app
from urllib.parse import unquote
import re


def register_and_login(client, username: str, email: str, password: str = "Password123") -> tuple[dict, dict]:
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
    return register.json(), login.json()


def auth_headers(access_token: str) -> dict:
    return {"Authorization": f"Bearer {access_token}"}


def test_users_me_get_and_patch(client):
    _, tokens = register_and_login(client, username="profile1", email="profile1@example.org")

    me = client.get("/api/v1/users/me", headers=auth_headers(tokens["accessToken"]))
    assert me.status_code == 200
    assert me.json()["username"] == "profile1"
    assert me.json()["preferences"] == {}
    assert me.json()["profileProperties"] == {}
    assert isinstance(me.json()["profilePropertyCatalog"], list)

    patch = client.patch(
        "/api/v1/users/me",
        headers=auth_headers(tokens["accessToken"]),
        json={"displayName": "Updated Profile", "preferences": {"theme": "dark"}},
    )
    assert patch.status_code == 200
    payload = patch.json()
    assert payload["displayName"] == "Updated Profile"
    assert payload["preferences"] == {"theme": "dark"}


def test_users_me_patch_profile_properties(client):
    _, tokens = register_and_login(client, username="profileprops1", email="profileprops1@example.org")

    previous = app.state.settings.profile_properties
    app.state.settings.profile_properties = "*"
    try:
        patch = client.patch(
            "/api/v1/users/me",
            headers=auth_headers(tokens["accessToken"]),
            json={
                "profileProperties": {
                    "orcid": "0000-0002-1825-0097",
                    "googleScholarUrl": "https://scholar.google.com/citations?user=tester",
                    "externalLinks": [
                        {"label": "Lab", "url": "https://example.org/lab"},
                        {"label": "CV", "url": "https://example.org/cv"},
                    ],
                }
            },
        )
        get_me = client.get("/api/v1/users/me", headers=auth_headers(tokens["accessToken"]))
    finally:
        app.state.settings.profile_properties = previous
    assert patch.status_code == 200
    payload = patch.json()
    assert payload["profileProperties"]["orcid"] == "0000-0002-1825-0097"
    assert len(payload["profileProperties"]["externalLinks"]) == 2
    assert get_me.status_code == 200
    assert get_me.json()["profileProperties"]["googleScholarUrl"].startswith("https://scholar.google.com/")


def test_users_me_patch_profile_properties_rejects_invalid_values(client):
    _, tokens = register_and_login(client, username="profileprops2", email="profileprops2@example.org")

    previous = app.state.settings.profile_properties
    app.state.settings.profile_properties = "*"
    try:
        invalid_orcid = client.patch(
            "/api/v1/users/me",
            headers=auth_headers(tokens["accessToken"]),
            json={"profileProperties": {"orcid": "bad-orcid"}},
        )
    finally:
        app.state.settings.profile_properties = previous
    assert invalid_orcid.status_code == 400
    assert invalid_orcid.json()["error"]["code"] == "PROFILE_PROPERTY_INVALID"

    previous = app.state.settings.profile_properties
    app.state.settings.profile_properties = "*"
    try:
        invalid_scholar_host = client.patch(
            "/api/v1/users/me",
            headers=auth_headers(tokens["accessToken"]),
            json={"profileProperties": {"googleScholarUrl": "https://example.org/not-scholar"}},
        )
    finally:
        app.state.settings.profile_properties = previous
    assert invalid_scholar_host.status_code == 400
    assert invalid_scholar_host.json()["error"]["code"] == "PROFILE_PROPERTY_INVALID"


def test_users_me_patch_profile_properties_rejects_disabled_property(client):
    _, tokens = register_and_login(client, username="profileprops3", email="profileprops3@example.org")

    previous = app.state.settings.profile_properties
    app.state.settings.profile_properties = "orcid"
    try:
        disabled = client.patch(
            "/api/v1/users/me",
            headers=auth_headers(tokens["accessToken"]),
            json={"profileProperties": {"googleScholarUrl": "https://scholar.google.com/citations?user=test"}},
        )
    finally:
        app.state.settings.profile_properties = previous

    assert disabled.status_code == 400
    assert disabled.json()["error"]["code"] == "PROFILE_PROPERTY_DISABLED"


def test_users_me_empty_profile_properties_config_hides_extended_catalog(client):
    _, tokens = register_and_login(client, username="profileprops4", email="profileprops4@example.org")

    previous = app.state.settings.profile_properties
    app.state.settings.profile_properties = ""
    try:
        me = client.get("/api/v1/users/me", headers=auth_headers(tokens["accessToken"]))
    finally:
        app.state.settings.profile_properties = previous

    assert me.status_code == 200
    assert me.json()["profilePropertyCatalog"] == []


def test_users_me_includes_direct_and_inherited_role_sources(client):
    _, owner_tokens = register_and_login(client, username="rolesowner", email="rolesowner@example.org")
    _, member_tokens = register_and_login(client, username="rolesmember", email="rolesmember@example.org")

    auth_store = app.state.auth_store
    owner = auth_store.authenticate_local_user("rolesowner", "Password123")
    member = auth_store.authenticate_local_user("rolesmember", "Password123")
    assert owner is not None
    assert member is not None

    owner.roles = ["GroupManager"]
    member.roles = ["AdminUsers"]

    created_group = client.post(
        "/api/v1/groups",
        headers=auth_headers(owner_tokens["accessToken"]),
        json={"name": "Inherited Role Group", "description": "for role source test"},
    )
    assert created_group.status_code == 200
    group_id = created_group.json()["id"]

    add_member = client.post(
        f"/api/v1/groups/{group_id}/members",
        headers=auth_headers(owner_tokens["accessToken"]),
        json={"usernameOrEmail": "rolesmember"},
    )
    assert add_member.status_code == 200

    auth_store.set_group_roles(group_id, ["InviteUsers"])

    me = client.get("/api/v1/users/me", headers=auth_headers(member_tokens["accessToken"]))
    assert me.status_code == 200
    payload = me.json()

    assert set(payload["roleSources"]["direct"]) == {"AdminUsers"}
    inherited = {item["name"]: item["groups"] for item in payload["roleSources"]["inherited"]}
    assert "InviteUsers" in inherited
    assert "Inherited Role Group" in inherited["InviteUsers"]
    assert set(payload["roles"]) == {"AdminUsers", "InviteUsers"}


def test_users_search_matches_display_name_username_and_email(client):
    _, owner_tokens = register_and_login(client, username="searchowner", email="search.owner@example.org")
    register_and_login(client, username="alphauser", email="alpha.member@example.org")

    by_username = client.get(
        "/api/v1/users/search",
        headers=auth_headers(owner_tokens["accessToken"]),
        params={"query": "alpha"},
    )
    assert by_username.status_code == 200
    assert any(item["username"] == "alphauser" for item in by_username.json()["items"])

    by_email = client.get(
        "/api/v1/users/search",
        headers=auth_headers(owner_tokens["accessToken"]),
        params={"query": "member@example.org"},
    )
    assert by_email.status_code == 200
    assert any(item["email"] == "alpha.member@example.org" for item in by_email.json()["items"])

    by_display_name = client.get(
        "/api/v1/users/search",
        headers=auth_headers(owner_tokens["accessToken"]),
        params={"query": "Alphauser"},
    )
    assert by_display_name.status_code == 200
    assert any(item["displayName"] == "Alphauser" for item in by_display_name.json()["items"])


def test_profile_email_change_resets_verification_without_deactivating(client):
    _, tokens = register_and_login(client, username="emailchange1", email="emailchange1@example.org")

    before = client.get("/api/v1/users/me", headers=auth_headers(tokens["accessToken"]))
    assert before.status_code == 200
    assert before.json()["status"] == "active"
    assert before.json()["emailVerified"] is True

    updated = client.patch(
        "/api/v1/users/me",
        headers=auth_headers(tokens["accessToken"]),
        json={"email": "new.emailchange1@example.org"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "active"
    assert updated.json()["email"] == "new.emailchange1@example.org"
    assert updated.json()["emailVerified"] is False

    login_new_email = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "new.emailchange1@example.org", "password": "Password123"},
    )
    assert login_new_email.status_code == 200


def test_resend_verification_email_for_unverified_address(client):
    _, tokens = register_and_login(client, username="resend1", email="resend1@example.org")

    changed = client.patch(
        "/api/v1/users/me",
        headers=auth_headers(tokens["accessToken"]),
        json={"email": "resend1.new@example.org"},
    )
    assert changed.status_code == 200
    assert changed.json()["emailVerified"] is False

    mail_sender = app.state.mail_sender
    assert hasattr(mail_sender, "outbox")
    outbox_before = len(mail_sender.outbox)

    resent = client.post(
        "/api/v1/users/me/resend-verification",
        headers=auth_headers(tokens["accessToken"]),
    )
    assert resent.status_code == 200
    assert resent.json()["success"] is True
    assert resent.json()["sent"] is True
    assert len(mail_sender.outbox) == outbox_before + 1


def test_resend_verification_email_noop_when_already_verified(client):
    _, tokens = register_and_login(client, username="resend2", email="resend2@example.org")

    resent = client.post(
        "/api/v1/users/me/resend-verification",
        headers=auth_headers(tokens["accessToken"]),
    )
    assert resent.status_code == 200
    assert resent.json()["success"] is True
    assert resent.json()["sent"] is False


def test_users_basic_view_requires_auth_and_shows_name_and_organization(client):
    register_payload, owner_tokens = register_and_login(client, username="viewerowner", email="viewerowner@example.org")
    _, viewer_tokens = register_and_login(client, username="vieweruser", email="vieweruser@example.org")

    updated = client.patch(
        "/api/v1/users/me",
        headers=auth_headers(owner_tokens["accessToken"]),
        json={"displayName": "Owner Visible Name", "preferences": {"organization": "Acme Org", "theme": "dark"}},
    )
    assert updated.status_code == 200

    unauthenticated = client.get(f"/api/v1/users/{register_payload['id']}")
    assert unauthenticated.status_code == 401

    visible = client.get(
        f"/api/v1/users/{register_payload['id']}",
        headers=auth_headers(viewer_tokens["accessToken"]),
    )
    assert visible.status_code == 200
    assert visible.json() == {
        "id": register_payload["id"],
        "displayName": "Owner Visible Name",
        "organization": "Acme Org",
    }


def test_group_owner_crud_flow(client):
    _, tokens = register_and_login(client, username="groupowner", email="groupowner@example.org")
    auth_store = app.state.auth_store
    owner = auth_store.authenticate_local_user("groupowner", "Password123")
    assert owner is not None
    owner.roles = ["GroupManager"]

    created = client.post(
        "/api/v1/groups",
        headers=auth_headers(tokens["accessToken"]),
        json={"name": "Research Team", "description": "Initial"},
    )
    assert created.status_code == 200
    group = created.json()
    assert group["name"] == "Research Team"

    listed = client.get("/api/v1/groups", headers=auth_headers(tokens["accessToken"]))
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 1
    assert listed.json()["items"][0]["id"] == group["id"]
    assert listed.json()["items"][0]["memberCount"] == 1

    updated = client.patch(
        f"/api/v1/groups/{group['id']}",
        headers=auth_headers(tokens["accessToken"]),
        json={"name": "Research Team Updated", "description": "Updated"},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Research Team Updated"

    deleted = client.delete(f"/api/v1/groups/{group['id']}", headers=auth_headers(tokens["accessToken"]))
    assert deleted.status_code == 200
    assert deleted.json()["success"] is True

    missing = client.get(f"/api/v1/groups/{group['id']}", headers=auth_headers(tokens["accessToken"]))
    assert missing.status_code == 404


def test_group_owner_protection_and_superuser_override(client):
    _, owner_tokens = register_and_login(client, username="owner2", email="owner2@example.org")
    _, other_tokens = register_and_login(client, username="other2", email="other2@example.org")

    auth_store = app.state.auth_store
    owner = auth_store.authenticate_local_user("owner2", "Password123")
    assert owner is not None
    owner.roles = ["GroupManager"]

    created = client.post(
        "/api/v1/groups",
        headers=auth_headers(owner_tokens["accessToken"]),
        json={"name": "Owner Group", "description": "Owned by owner2"},
    )
    group_id = created.json()["id"]

    forbidden_get = client.get(f"/api/v1/groups/{group_id}", headers=auth_headers(other_tokens["accessToken"]))
    assert forbidden_get.status_code == 403

    forbidden_patch = client.patch(
        f"/api/v1/groups/{group_id}",
        headers=auth_headers(other_tokens["accessToken"]),
        json={"name": "Nope"},
    )
    assert forbidden_patch.status_code == 403

    forbidden_delete = client.delete(f"/api/v1/groups/{group_id}", headers=auth_headers(other_tokens["accessToken"]))
    assert forbidden_delete.status_code == 403

    other_user = auth_store.authenticate_local_user("other2", "Password123")
    assert other_user is not None
    other_user.roles = ["Superuser"]

    super_login = client.post(
        "/api/v1/auth/login",
        json={"usernameOrEmail": "other2", "password": "Password123"},
    )
    super_token = super_login.json()["accessToken"]

    allowed_get = client.get(f"/api/v1/groups/{group_id}", headers=auth_headers(super_token))
    assert allowed_get.status_code == 200

    allowed_patch = client.patch(
        f"/api/v1/groups/{group_id}",
        headers=auth_headers(super_token),
        json={"description": "Superuser edit"},
    )
    assert allowed_patch.status_code == 200

    allowed_delete = client.delete(f"/api/v1/groups/{group_id}", headers=auth_headers(super_token))
    assert allowed_delete.status_code == 200


def test_group_membership_management_and_mine_lists(client):
    _, owner_tokens = register_and_login(client, username="groupowner2", email="groupowner2@example.org")
    _, member_tokens = register_and_login(client, username="member2", email="member2@example.org")

    auth_store = app.state.auth_store
    owner = auth_store.authenticate_local_user("groupowner2", "Password123")
    assert owner is not None
    owner.roles = ["GroupManager"]

    created = client.post(
        "/api/v1/groups",
        headers=auth_headers(owner_tokens["accessToken"]),
        json={"name": "Lab Group", "description": "Owned by groupowner2"},
    )
    assert created.status_code == 200
    group_id = created.json()["id"]

    add_member = client.post(
        f"/api/v1/groups/{group_id}/members",
        headers=auth_headers(owner_tokens["accessToken"]),
        json={"usernameOrEmail": "member2"},
    )
    assert add_member.status_code == 200

    members = client.get(f"/api/v1/groups/{group_id}/members", headers=auth_headers(owner_tokens["accessToken"]))
    assert members.status_code == 200
    assert len(members.json()["items"]) == 2

    owner_mine = client.get("/api/v1/groups/mine", headers=auth_headers(owner_tokens["accessToken"]))
    assert owner_mine.status_code == 200
    assert len(owner_mine.json()["owned"]) == 1
    assert owner_mine.json()["owned"][0]["memberCount"] == 2
    assert owner_mine.json()["memberOf"] == []

    member_mine = client.get("/api/v1/groups/mine", headers=auth_headers(member_tokens["accessToken"]))
    assert member_mine.status_code == 200
    assert member_mine.json()["owned"] == []
    assert len(member_mine.json()["memberOf"]) == 1
    assert member_mine.json()["memberOf"][0]["ownerDisplayName"] == "Groupowner2"

    member_group_detail = client.get(f"/api/v1/groups/{group_id}", headers=auth_headers(member_tokens["accessToken"]))
    assert member_group_detail.status_code == 200
    assert member_group_detail.json()["canManage"] is False

    member_add_forbidden = client.post(
        f"/api/v1/groups/{group_id}/members",
        headers=auth_headers(member_tokens["accessToken"]),
        json={"usernameOrEmail": "groupowner2"},
    )
    assert member_add_forbidden.status_code == 403

    member_record = next(item for item in members.json()["items"] if item["username"] == "member2")
    remove_member = client.delete(
        f"/api/v1/groups/{group_id}/members/{member_record['userId']}",
        headers=auth_headers(owner_tokens["accessToken"]),
    )
    assert remove_member.status_code == 200

    owner_mine_after_remove = client.get("/api/v1/groups/mine", headers=auth_headers(owner_tokens["accessToken"]))
    assert owner_mine_after_remove.json()["owned"][0]["memberCount"] == 1
