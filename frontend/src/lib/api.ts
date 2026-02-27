export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthProviderMeta = {
  id: string;
  displayName: string;
  type: string;
};

export type AuthProvidersResponse = {
  appName: string;
  appIcon: string;
  localRegistrationEnabled: boolean;
  providers: AuthProviderMeta[];
};

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";

async function parseJson(response: Response): Promise<any> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message ?? "Request failed";
    throw new Error(message);
  }
  return payload;
}

export async function login(usernameOrEmail: string, password: string): Promise<AuthTokens> {
  return parseJson(
    await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernameOrEmail, password }),
    }),
  );
}

export type RegisterResponse = {
  id: string;
  email: string;
  status: string;
  emailVerified: boolean;
  accessToken?: string;
  refreshToken?: string;
};

export async function register(username: string, email: string, password: string, displayName?: string): Promise<RegisterResponse> {
  return parseJson(
    await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, displayName }),
    }),
  );
}

export async function getAuthProviders(): Promise<AuthProvidersResponse> {
  return parseJson(await fetch(`${API_BASE}/meta/auth-providers`));
}

export async function startRedirectProvider(providerId: string): Promise<{ provider: string; mode: string; redirectUrl?: string | null }> {
  return parseJson(await fetch(`${API_BASE}/auth/${providerId}/start`));
}

export async function verifyEmail(token: string): Promise<{ success: boolean; status: string; emailVerified: boolean }> {
  const params = new URLSearchParams({ token });
  return parseJson(await fetch(`${API_BASE}/auth/verify-email?${params.toString()}`));
}

export async function getInvitation(token: string): Promise<{ valid: boolean; invitedEmail: string; groupIds: string[]; expiresAt: string }> {
  return parseJson(await fetch(`${API_BASE}/auth/invitations/${encodeURIComponent(token)}`));
}

export async function acceptInvitation(accessToken: string, token: string): Promise<{ success: boolean; groupIds: string[]; acceptedByUserId: string }> {
  return parseJson(
    await fetch(`${API_BASE}/auth/invitations/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ token }),
    }),
  );
}

export async function refreshSession(refreshToken: string): Promise<AuthTokens> {
  return parseJson(
    await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }),
  );
}

export async function logout(refreshToken: string): Promise<{ success: boolean }> {
  return parseJson(
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }),
  );
}

export async function getMyProfile(accessToken: string): Promise<any> {
  return parseJson(
    await fetch(`${API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function searchUsers(accessToken: string, query: string, limit = 10): Promise<{ items: any[] }> {
  const params = new URLSearchParams({ query, limit: String(limit) });
  return parseJson(
    await fetch(`${API_BASE}/users/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function patchMyProfile(accessToken: string, body: { displayName?: string; email?: string; preferences?: Record<string, unknown> }): Promise<any> {
  return parseJson(
    await fetch(`${API_BASE}/users/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

export async function resendMyVerificationEmail(accessToken: string): Promise<{ success: boolean; sent: boolean; message: string }> {
  return parseJson(
    await fetch(`${API_BASE}/users/me/resend-verification`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function getUserBasic(accessToken: string, userId: string): Promise<{ id: string; displayName: string; organization: string | null }> {
  return parseJson(
    await fetch(`${API_BASE}/users/${userId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function listMyGroups(accessToken: string): Promise<{ items: any[] }> {
  return parseJson(
    await fetch(`${API_BASE}/groups`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function listMyGroupCollections(accessToken: string): Promise<{ owned: any[]; memberOf: any[] }> {
  return parseJson(
    await fetch(`${API_BASE}/groups/mine`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function getGroup(accessToken: string, groupId: string): Promise<any> {
  return parseJson(
    await fetch(`${API_BASE}/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function listGroupMembers(accessToken: string, groupId: string): Promise<{ items: any[] }> {
  return parseJson(
    await fetch(`${API_BASE}/groups/${groupId}/members`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function addGroupMember(accessToken: string, groupId: string, usernameOrEmail: string): Promise<{ success: boolean }> {
  return parseJson(
    await fetch(`${API_BASE}/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ usernameOrEmail }),
    }),
  );
}

export async function removeGroupMember(accessToken: string, groupId: string, userId: string): Promise<{ success: boolean }> {
  return parseJson(
    await fetch(`${API_BASE}/groups/${groupId}/members/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function createGroup(accessToken: string, body: { name: string; description?: string }): Promise<any> {
  return parseJson(
    await fetch(`${API_BASE}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

export async function patchGroup(accessToken: string, groupId: string, body: { name?: string; description?: string }): Promise<any> {
  return parseJson(
    await fetch(`${API_BASE}/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteGroup(accessToken: string, groupId: string): Promise<{ success: boolean }> {
  return parseJson(
    await fetch(`${API_BASE}/groups/${groupId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function canAccessUserManagement(accessToken: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/auth/user-management-check`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.ok) {
    return true;
  }
  if (response.status === 401 || response.status === 403) {
    return false;
  }

  const payload = await response.json().catch(() => ({}));
  const message = payload?.error?.message ?? "Unable to verify admin access";
  throw new Error(message);
}

export type AdminCapabilities = {
  anyAdmin: boolean;
  users: boolean;
  groups: boolean;
  invitations: boolean;
  roles: boolean;
  effectiveRoles: string[];
};

export async function getAdminCapabilities(accessToken: string): Promise<AdminCapabilities> {
  return parseJson(
    await fetch(`${API_BASE}/auth/admin-capabilities`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export type AdminUserListItem = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  status: string;
  roles: string[];
};

export async function adminListUsers(accessToken: string): Promise<{ items: AdminUserListItem[] }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export type AdminUserDetail = AdminUserListItem & {
  emailNormalized: string;
  organization: string | null;
  preferences: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export async function adminGetUser(accessToken: string, userId: string): Promise<AdminUserDetail> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminResetUserPassword(accessToken: string, userId: string): Promise<{ success: boolean; delivery: string; message: string }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users/${userId}/reset-password`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminPatchUser(
  accessToken: string,
  userId: string,
  body: { displayName?: string; status?: string; roles?: string[]; preferences?: Record<string, unknown> },
): Promise<any> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

export async function adminInviteUsers(
  accessToken: string,
  body: { emails: string[]; groupIds: string[] },
): Promise<{ invited: number; addedExisting: number; failures: { email: string; error: string }[] }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

export type AdminOutstandingInvitation = {
  id: string;
  invitedEmail: string;
  invitedByUserId: string;
  invitedByDisplayName: string | null;
  groupIds: string[];
  groupNames: string[];
  createdAt: string;
  expiresAt: string;
};

export async function adminListOutstandingInvitations(accessToken: string): Promise<{ items: AdminOutstandingInvitation[] }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users/invitations`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminResendInvitation(accessToken: string, invitationId: string): Promise<{ success: boolean; invitation: AdminOutstandingInvitation }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users/invitations/${encodeURIComponent(invitationId)}/resend`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminRevokeInvitation(accessToken: string, invitationId: string): Promise<{ success: boolean }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users/invitations/${encodeURIComponent(invitationId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export type AdminRoleItem = {
  name: string;
  description?: string | null;
};

export async function adminListRoles(accessToken: string): Promise<{ items: AdminRoleItem[] }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/roles`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminCreateRole(accessToken: string, name: string, description?: string): Promise<AdminRoleItem> {
  return parseJson(
    await fetch(`${API_BASE}/admin/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ name, description }),
    }),
  );
}

export async function adminPatchRole(accessToken: string, roleName: string, description?: string): Promise<AdminRoleItem> {
  return parseJson(
    await fetch(`${API_BASE}/admin/roles/${encodeURIComponent(roleName)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ description }),
    }),
  );
}

export async function adminDeleteRole(accessToken: string, roleName: string): Promise<{ success: boolean }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/roles/${encodeURIComponent(roleName)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminListGroups(accessToken: string): Promise<{ items: any[] }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/groups`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminListAssignableGroupRoles(accessToken: string): Promise<{ items: AdminRoleItem[] }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/groups/assignable-roles`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminPatchGroup(
  accessToken: string,
  groupId: string,
  body: { name?: string; description?: string },
): Promise<any> {
  return parseJson(
    await fetch(`${API_BASE}/admin/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

export async function adminDeleteGroup(accessToken: string, groupId: string): Promise<{ success: boolean }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/groups/${groupId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminAssignGroupRoles(accessToken: string, groupId: string, roles: string[]): Promise<any> {
  return parseJson(
    await fetch(`${API_BASE}/admin/groups/${groupId}/roles`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ roles }),
    }),
  );
}
