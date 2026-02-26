export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
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

export async function patchMyProfile(accessToken: string, body: { displayName?: string; preferences?: Record<string, unknown> }): Promise<any> {
  return parseJson(
    await fetch(`${API_BASE}/users/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
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
