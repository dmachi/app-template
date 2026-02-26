from app.main import app


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

    patch = client.patch(
        "/api/v1/users/me",
        headers=auth_headers(tokens["accessToken"]),
        json={"displayName": "Updated Profile", "preferences": {"theme": "dark"}},
    )
    assert patch.status_code == 200
    payload = patch.json()
    assert payload["displayName"] == "Updated Profile"
    assert payload["preferences"] == {"theme": "dark"}


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


def test_group_owner_crud_flow(client):
    _, tokens = register_and_login(client, username="groupowner", email="groupowner@example.org")

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

    auth_store = app.state.auth_store
    other_user = auth_store.authenticate_local_user("other2", "Password123")
    assert other_user is not None
    other_user.roles = ["superuser"]

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
