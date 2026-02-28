import { Dispatch, FormEvent, SetStateAction, useCallback } from "react";

import { login, logout, register, startRedirectProvider } from "../../lib/api";

type UseAppAuthActionsParams = {
  usernameOrEmail: string;
  password: string;
  registerUsername: string;
  registerEmail: string;
  registerPassword: string;
  registerDisplayName: string;
  registerProfileProperties: Record<string, unknown>;
  refreshTokenStorageKey: string;
  inviteTokenStorageKey: string;
  refreshToken: string | null;
  pendingInvitationToken: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  setAccessToken: Dispatch<SetStateAction<string | null>>;
  setRefreshToken: Dispatch<SetStateAction<string | null>>;
  setPassword: Dispatch<SetStateAction<string>>;
  setUsernameOrEmail: Dispatch<SetStateAction<string>>;
  setRegisterPassword: Dispatch<SetStateAction<string>>;
  setCurrentUsername: Dispatch<SetStateAction<string>>;
  setTheme: Dispatch<SetStateAction<"light" | "dark" | "system">>;
  setPendingInvitationToken: Dispatch<SetStateAction<string | null>>;
  setAcceptingInvitation: Dispatch<SetStateAction<boolean>>;
  setInvitationAcceptanceMessage: Dispatch<SetStateAction<string | null>>;
  setAdminCapabilities: Dispatch<SetStateAction<{ users: boolean; groups: boolean; invitations: boolean; roles: boolean }>>;
  setInviteDialogOpen: Dispatch<SetStateAction<boolean>>;
  navigateHome: () => void;
  navigateLogin: () => void;
  navigateTo: (to: string, replace?: boolean) => void;
};

export function useAppAuthActions(params: UseAppAuthActionsParams) {
  const {
    usernameOrEmail,
    password,
    registerUsername,
    registerEmail,
    registerPassword,
    registerDisplayName,
    registerProfileProperties,
    refreshTokenStorageKey,
    inviteTokenStorageKey,
    refreshToken,
    pendingInvitationToken,
    setError,
    setAccessToken,
    setRefreshToken,
    setPassword,
    setUsernameOrEmail,
    setRegisterPassword,
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

  const handleLogin = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const tokens = await login(usernameOrEmail, password);
      setAccessToken(tokens.accessToken);
      setRefreshToken(tokens.refreshToken);
      window.localStorage.setItem(refreshTokenStorageKey, tokens.refreshToken);
      setPassword("");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to login");
    }
  }, [password, refreshTokenStorageKey, setAccessToken, setError, setPassword, setRefreshToken, usernameOrEmail]);

  const handleRegister = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const response = await register(
        registerUsername,
        registerEmail,
        registerPassword,
        registerDisplayName || undefined,
        registerProfileProperties,
      );
      setRegisterPassword("");

      if (response.accessToken && response.refreshToken) {
        setAccessToken(response.accessToken);
        setRefreshToken(response.refreshToken);
        window.localStorage.setItem(refreshTokenStorageKey, response.refreshToken);
        navigateHome();
        setError("Registration successful. You are signed in. Please verify your email from the link we sent.");
        return;
      }

      navigateLogin();
      setUsernameOrEmail(registerUsername || registerEmail);
      setPassword("");
      setError("Registration successful. Check your email for a verification link before logging in.");
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : "Unable to register");
    }
  }, [
    navigateHome,
    navigateLogin,
    refreshTokenStorageKey,
    registerDisplayName,
    registerEmail,
    registerPassword,
    registerProfileProperties,
    registerUsername,
    setAccessToken,
    setError,
    setPassword,
    setRefreshToken,
    setRegisterPassword,
    setUsernameOrEmail,
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
      setPassword("");
      setPendingInvitationToken(null);
      setAcceptingInvitation(false);
      setInvitationAcceptanceMessage(null);
      setAdminCapabilities({ users: false, groups: false, invitations: false, roles: false });
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
    setPassword,
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
