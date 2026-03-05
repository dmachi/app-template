import { API_BASE, parseJson } from "./core";
import type {
  AdminCapabilities,
  AuthProvidersResponse,
  AuthTokens,
  RegisterResponse,
} from "./core";

export {
  type AuthTokens,
  type AuthProviderMeta,
  type AuthProvidersResponse,
  type ProfilePropertyValueType,
  type ProfilePropertyLinkItem,
  type ProfilePropertyCatalogItem,
  type RegisterResponse,
  type AdminCapabilities,
} from "./core";

export async function login(usernameOrEmail: string, password: string): Promise<AuthTokens> {
  return parseJson(
    await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernameOrEmail, password }),
    }),
  );
}

export async function register(
  username: string,
  email: string,
  password: string,
  displayName?: string,
  profileProperties?: Record<string, unknown>,
): Promise<RegisterResponse> {
  return parseJson(
    await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, displayName, profileProperties }),
    }),
  );
}

export async function getAuthProviders(): Promise<AuthProvidersResponse> {
  return parseJson(await fetch(`${API_BASE}/meta/auth-providers`));
}

export async function startRedirectProvider(providerId: string): Promise<{ provider: string; mode: string; redirectUrl?: string | null }> {
  return parseJson(await fetch(`${API_BASE}/auth/${providerId}/start`));
}

export async function establishOAuthSession(
  accessToken: string,
  returnTo: string,
): Promise<{ success: boolean; redirectUrl: string }> {
  return parseJson(
    await fetch(`${API_BASE}/oauth/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: "include",
      body: JSON.stringify({ returnTo }),
    }),
  );
}

export async function getOAuthConsentDetails(
  accessToken: string,
  returnTo: string,
): Promise<{ returnTo: string; clientId: string; clientName: string; scopes: string[] }> {
  const params = new URLSearchParams({ return_to: returnTo });
  return parseJson(
    await fetch(`${API_BASE}/oauth/consent/details?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: "include",
    }),
  );
}

export async function submitOAuthConsentDecision(
  accessToken: string,
  returnTo: string,
  decision: "approve" | "deny",
): Promise<{ success: boolean; decision: "approve" | "deny"; redirectUrl: string }> {
  return parseJson(
    await fetch(`${API_BASE}/oauth/consent/decision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: "include",
      body: JSON.stringify({ returnTo, decision }),
    }),
  );
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

export async function getAdminCapabilities(accessToken: string): Promise<AdminCapabilities> {
  return parseJson(
    await fetch(`${API_BASE}/auth/admin-capabilities`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}
