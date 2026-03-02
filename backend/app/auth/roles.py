ROLE_SUPERUSER = "Superuser"
ROLE_CONTENT_ADMIN = "ContentAdmin"
ROLE_CONTENT_EDITOR_LEGACY = "ContentEditor"
ROLE_ADMIN_USERS = "AdminUsers"
ROLE_ADMIN_GROUPS = "AdminGroups"
ROLE_GROUP_MANAGER = "GroupManager"
ROLE_INVITE_USERS = "InviteUsers"

CORE_ROLE_DESCRIPTIONS: dict[str, str] = {
    ROLE_SUPERUSER: "Can do anything",
    ROLE_CONTENT_ADMIN: "Can create/edit/publish CMS content and manage media",
    ROLE_ADMIN_USERS: "Can view/reset/disable users and assign non-superuser roles",
    ROLE_ADMIN_GROUPS: "Can view/edit/modify all groups and assign roles to groups",
    ROLE_GROUP_MANAGER: "Can create and manage groups they own",
    ROLE_INVITE_USERS: "Can invite new users",
}

NON_DELETABLE_CORE_ROLES = set(CORE_ROLE_DESCRIPTIONS.keys())

ADMIN_USER_ROLES = {ROLE_SUPERUSER, ROLE_ADMIN_USERS}
ADMIN_GROUP_ROLES = {ROLE_SUPERUSER, ROLE_ADMIN_GROUPS}
INVITE_USER_ROLES = {ROLE_SUPERUSER, ROLE_INVITE_USERS}
GROUP_MANAGER_ROLES = {ROLE_SUPERUSER, ROLE_ADMIN_GROUPS, ROLE_GROUP_MANAGER}
USER_MANAGEMENT_CHECK_ROLES = {ROLE_SUPERUSER, ROLE_ADMIN_USERS, ROLE_ADMIN_GROUPS, ROLE_INVITE_USERS}


def resolve_effective_roles(auth_store, *, user_id: str, direct_roles: list[str] | None = None) -> set[str]:
    if hasattr(auth_store, "get_effective_roles_for_user"):
        return set(auth_store.get_effective_roles_for_user(user_id))
    return set(direct_roles or [])


def has_any_role(
    auth_store,
    *,
    user_id: str,
    required_roles: set[str] | list[str] | tuple[str, ...],
    direct_roles: list[str] | None = None,
) -> bool:
    effective_roles = resolve_effective_roles(auth_store, user_id=user_id, direct_roles=direct_roles)
    return bool(effective_roles.intersection(set(required_roles)))
