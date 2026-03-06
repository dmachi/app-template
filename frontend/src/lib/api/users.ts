import { API_BASE, parseJson } from "./core";
import type { AccessTokenCreateResponse, AccessTokenItem, AuthScopeItem, MyProfileResponse } from "./core";

export {
  type MyProfileResponse,
} from "./core";

export type {
  AccessTokenItem,
  AuthScopeItem,
} from "./core";

export type ConnectedAppItem = {
  clientId: string;
  name: string;
  scopes: string[];
  connectedAt: string;
  updatedAt: string;
};

export type CreateAccessTokenRequest = {
  name: string;
  scopes: string[];
  expiresAt?: string;
};

export async function getMyProfile(accessToken: string): Promise<MyProfileResponse> {
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

export async function patchMyProfile(
  accessToken: string,
  body: { displayName?: string; email?: string; preferences?: Record<string, unknown>; profileProperties?: Record<string, unknown> },
): Promise<MyProfileResponse> {
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

export async function getUserBasic(accessToken: string, userId: string): Promise<{ id: string; displayName: string }> {
  return parseJson(
    await fetch(`${API_BASE}/users/${userId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function listMyConnectedApps(accessToken: string): Promise<{ items: ConnectedAppItem[] }> {
  return parseJson(
    await fetch(`${API_BASE}/users/me/connected-apps`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function revokeMyConnectedApp(accessToken: string, clientId: string): Promise<{ success: boolean; revoked: boolean }> {
  return parseJson(
    await fetch(`${API_BASE}/users/me/connected-apps/${encodeURIComponent(clientId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function listMyAccessTokenScopes(accessToken: string): Promise<{ items: AuthScopeItem[] }> {
  return parseJson(
    await fetch(`${API_BASE}/users/me/access-token-scopes`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function listMyAccessTokens(accessToken: string): Promise<{ items: AccessTokenItem[] }> {
  return parseJson(
    await fetch(`${API_BASE}/users/me/access-tokens`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function createMyAccessToken(accessToken: string, body: CreateAccessTokenRequest): Promise<AccessTokenCreateResponse> {
  return parseJson(
    await fetch(`${API_BASE}/users/me/access-tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

export async function revokeMyAccessToken(accessToken: string, tokenId: string): Promise<{ success: boolean; revoked: boolean }> {
  return parseJson(
    await fetch(`${API_BASE}/users/me/access-tokens/${encodeURIComponent(tokenId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}
