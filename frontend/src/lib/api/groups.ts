import { API_BASE, parseJson } from "./core";

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
