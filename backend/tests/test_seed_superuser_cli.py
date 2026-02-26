from app.cli.seed_superuser import normalize_email, upsert_superuser_user


class FakeUsersCollection:
    def __init__(self):
        self.docs = []

    def find_one(self, query):
        email_target = query["$or"][0]["email_normalized"]
        username_regex = query["$or"][1]["username"]["$regex"].strip("^").strip("$")
        for doc in self.docs:
            if doc["email_normalized"] == email_target or doc["username"].lower() == username_regex.lower():
                return doc
        return None

    def insert_one(self, doc):
        self.docs.append(doc)

    def update_one(self, query, update):
        target_id = query["id"]
        for index, doc in enumerate(self.docs):
            if doc["id"] == target_id:
                self.docs[index] = {**doc, **update["$set"]}
                return


def test_normalize_email():
    assert normalize_email("  USER@Example.ORG ") == "user@example.org"


def test_upsert_superuser_user_creates_document():
    users = FakeUsersCollection()

    action, user_id = upsert_superuser_user(
        users,
        username="root",
        email="root@example.org",
        password="StrongPass123",
        display_name="Root User",
        superuser_role_name="superuser",
    )

    assert action == "created"
    assert user_id
    assert len(users.docs) == 1
    assert users.docs[0]["email_normalized"] == "root@example.org"
    assert users.docs[0]["roles"] == ["superuser"]


def test_upsert_superuser_user_updates_existing_and_preserves_single_role():
    users = FakeUsersCollection()
    first_action, first_id = upsert_superuser_user(
        users,
        username="root2",
        email="root2@example.org",
        password="StrongPass123",
        display_name="Root User 2",
        superuser_role_name="superuser",
    )
    assert first_action == "created"

    second_action, second_id = upsert_superuser_user(
        users,
        username="root2",
        email="ROOT2@example.org",
        password="NewStrongPass123",
        display_name="Root User 2 Updated",
        superuser_role_name="superuser",
    )

    assert second_action == "updated"
    assert second_id == first_id
    assert len(users.docs) == 1
    assert users.docs[0]["display_name"] == "Root User 2 Updated"
    assert users.docs[0]["roles"].count("superuser") == 1
