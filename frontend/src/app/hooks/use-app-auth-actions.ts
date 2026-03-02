import { Dispatch, SetStateAction, useCallback } from "react";

import { login, logout, register, startRedirectProvider } from "../../lib/api";
import type { AdminCapabilities } from "./types";

type UseAppAuthActionsParams = {
  refreshTokenStorageKey: string;
  inviteTokenStorageKey: string;
  refreshToken: string | null;
  pendingInvitationToken: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  setAccessToken: Dispatch<SetStateAction<string | null>>;
  setRefreshToken: Dispatch<SetStateAction<string | null>>;
  setCurrentUsername: Dispatch<SetStateAction<string>>;
  setTheme: Dispatch<SetStateAction<"light" | "dark" | "system">>;
  setPendingInvitationToken: Dispatch<SetStateAction<string | null>>;
  setAcceptingInvitation: Dispatch<SetStateAction<boolean>>;
  setInvitationAcceptanceMessage: Dispatch<SetStateAction<string | null>>;
  setAdminCapabilities: Dispatch<SetStateAction<AdminCapabilities>>;
  setInviteDialogOpen: Dispatch<SetStateAction<boolean>>;
  navigateHome: () => void;
  navigateLogin: () => void;
  navigateTo: (to: string, replace?: boolean) => void;
};

type LoginCredentials = {
  usernameOrEmail: string;
  password: string;
};

type RegisterPayload = {
  username: string;
  email: string;
  password: string;
  displayName: string;
  profileProperties: Record<string, unknown>;
};

export function useAppAuthActions(params: UseAppAuthActionsParams) {
  const {
    refreshTokenStorageKey,
    inviteTokenStorageKey,
    refreshToken,
    pendingInvitationToken,
    setError,
    setAccessToken,
    setRefreshToken,
    setCurrentUsername,
    setTheme,
    setPendingInvitationToken,
    setAcceptingInvitation,
    setInvitationAcceptanceMessage,
    setAdminCapabilities,
    setInviteDialogOpen,
    navigateHome,
    navigateLogin,
    navigateTo,
  } = params;

  const handleLogin = useCallback(async (credentials: LoginCredentials) => {
    setError(null);
    try {
      const tokens = await login(credentials.usernameOrEmail, credentials.password);
      setAccessToken(tokens.accessToken);
      setRefreshToken(tokens.refreshToken);
      window.localStorage.setItem(refreshTokenStorageKey, tokens.refreshToken);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to login");
    }
  }, [refreshTokenStorageKey, setAccessToken, setError, setRefreshToken]);

  const handleRegister = useCallback(async (payload: RegisterPayload) => {
    setError(null);
    try {
      const response = await register(
        payload.username,
        payload.email,
        payload.password,
        payload.displayName || undefined,
        payload.profileProperties,
      );

      if (response.accessToken && response.refreshToken) {
        setAccessToken(response.accessToken);
        setRefreshToken(response.refreshToken);
        window.localStorage.setItem(refreshTokenStorageKey, response.refreshToken);
        navigateHome();
        setError("Registration successful. You are signed in. Please verify your email from the link we sent.");
        return;
      }

      navigateLogin();
      setError("Registration successful. Check your email for a verification link before logging in.");
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : "Unable to register");
    }
  }, [
    navigateHome,
    navigateLogin,
    refreshTokenStorageKey,
    setAccessToken,
    setError,
    setRefreshToken,
  ]);

  const handleProviderStart = useCallback(async (providerId: string) => {
    setError(null);
    try {
      if (pendingInvitationToken) {
        window.localStorage.setItem(inviteTokenStorageKey, pendingInvitationToken);
      }
      const result = await startRedirectProvider(providerId);
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      } else {
        setError(`Provider ${providerId} is not yet available in this environment.`);
      }
    } catch (providerError) {
      setError(providerError instanceof Error ? providerError.message : "Unable to start provider login");
    }
  }, [inviteTokenStorageKey, pendingInvitationToken, setError]);

  const handleLogout = useCallback(async () => {
    try {
      if (refreshToken) {
        await logout(refreshToken);
      }
    } catch {
    } finally {
      window.localStorage.removeItem(refreshTokenStorageKey);
      setAccessToken(null);
      setRefreshToken(null);
      setCurrentUsername("User");
      setTheme("system");
      setPendingInvitationToken(null);
      setAcceptingInvitation(false);
      setInvitationAcceptanceMessage(null);
      setAdminCapabilities({ users: false, groups: false, invitations: false, roles: false, content: false, contentTypes: false });
      setInviteDialogOpen(false);
      window.localStorage.removeItem(inviteTokenStorageKey);
      navigateTo("/", true);
    }
  }, [
    inviteTokenStorageKey,
    navigateTo,
    refreshToken,
    refreshTokenStorageKey,
    setAccessToken,
    setAcceptingInvitation,
    setAdminCapabilities,
    setCurrentUsername,
    setInvitationAcceptanceMessage,
    setInviteDialogOpen,
    setPendingInvitationToken,
    setRefreshToken,
    setTheme,
  ]);

  return {
    handleLogin,
    handleRegister,
    handleProviderStart,
    handleLogout,
  };
}
