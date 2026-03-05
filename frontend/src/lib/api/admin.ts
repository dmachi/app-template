import { API_BASE, parseJson } from "./core";
import type {
  AdminOAuthClientItem,
  AdminOutstandingInvitation,
  AdminRoleItem,
  AdminUserDetail,
  AdminUserGroupMembership,
  AdminUserListItem,
} from "./core";

export {
  type AdminOAuthClientItem,
  type AdminUserListItem,
  type AdminUserDetail,
  type AdminUserGroupMembership,
  type AdminOutstandingInvitation,
  type AdminRoleItem,
} from "./core";

export async function adminListUsers(accessToken: string): Promise<{ items: AdminUserListItem[] }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

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

export async function adminResendUserVerificationEmail(
  accessToken: string,
  userId: string,
): Promise<{ success: boolean; sent: boolean; message: string }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users/${userId}/resend-verification`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminListUserGroups(accessToken: string, userId: string): Promise<{ items: AdminUserGroupMembership[] }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users/${userId}/groups`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminPatchUser(
  accessToken: string,
  userId: string,
  body: {
    displayName?: string;
    email?: string;
    status?: string;
    roles?: string[];
    preferences?: Record<string, unknown>;
    profileProperties?: Record<string, unknown>;
  },
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

export async function adminCopyInvitationLink(
  accessToken: string,
  invitationId: string,
): Promise<{ success: boolean; invitation: AdminOutstandingInvitation; invitationLink: string }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users/invitations/${encodeURIComponent(invitationId)}/copy-link`, {
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

export async function adminListOAuthClients(accessToken: string): Promise<{ items: AdminOAuthClientItem[] }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/oauth/clients`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminCreateOAuthClient(
  accessToken: string,
  body: {
    name: string;
    redirectUris: string[];
    allowedScopes: string[];
    grantTypes: string[];
    trusted: boolean;
    tokenEndpointAuthMethod: "none" | "client_secret_post";
  },
): Promise<AdminOAuthClientItem & { clientSecret?: string }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/oauth/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

export async function adminPatchOAuthClient(
  accessToken: string,
  clientId: string,
  body: {
    name?: string;
    redirectUris?: string[];
    allowedScopes?: string[];
    grantTypes?: string[];
    trusted?: boolean;
    tokenEndpointAuthMethod?: "none" | "client_secret_post";
    rotateSecret?: boolean;
  },
): Promise<AdminOAuthClientItem & { clientSecret?: string }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/oauth/clients/${encodeURIComponent(clientId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

export async function adminDeleteOAuthClient(accessToken: string, clientId: string): Promise<{ success: boolean }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/oauth/clients/${encodeURIComponent(clientId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}
