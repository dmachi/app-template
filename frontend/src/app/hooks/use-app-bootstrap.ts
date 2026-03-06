import { Dispatch, SetStateAction, useCallback, useEffect, useRef } from "react";

import { resolveProfileThemePreferenceOverride } from "../../extensions/app-hooks/bootstrap";
import { CLIENT_TOAST_EVENT, type ClientToastEventDetail } from "../../lib/client-toast";
import {
  getAdminCapabilities,
  getAuthProviders,
  getMyProfile,
  refreshSession,
  type AuthProviderMeta,
  type ProfilePropertyCatalogItem,
} from "../../lib/api";
import { getEmptyAdminCapabilities, mapApiAdminCapabilitiesToApp } from "./admin-capabilities-core";
import type { AdminCapabilities } from "./types";

const DEFAULT_APP_NAME = import.meta.env.VITE_APP_NAME?.trim() || "Basic System Template";

type ClientPopupToast = {
  id: string;
  title: string;
  message: string;
  severity: "info" | "success" | "warning" | "error";
  open: boolean;
};

type UseSessionRestoreParams = {
  refreshTokenStorageKey: string;
  setAccessToken: Dispatch<SetStateAction<string | null>>;
  setRefreshToken: Dispatch<SetStateAction<string | null>>;
  setRestoringSession: Dispatch<SetStateAction<boolean>>;
};

type UseSessionAutoRefreshParams = {
  accessToken: string | null;
  refreshToken: string | null;
  refreshTokenStorageKey: string;
  setAccessToken: Dispatch<SetStateAction<string | null>>;
  setRefreshToken: Dispatch<SetStateAction<string | null>>;
};

type UseAuthMetaParams = {
  setAppName: Dispatch<SetStateAction<string>>;
  setAppIcon: Dispatch<SetStateAction<string>>;
  setAuthProviders: Dispatch<SetStateAction<AuthProviderMeta[]>>;
  setRegistrationEnabled: Dispatch<SetStateAction<boolean>>;
  setRegisterProfilePropertyCatalog: Dispatch<SetStateAction<ProfilePropertyCatalogItem[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setAuthMetaLoaded: Dispatch<SetStateAction<boolean>>;
};

type ThemeOption = "light" | "dark" | "system";

type UseProfileAndAdminBootstrapParams = {
  accessToken: string | null;
  setCurrentUsername: Dispatch<SetStateAction<string>>;
  setTheme: Dispatch<SetStateAction<ThemeOption>>;
  setCanAccessAdmin: Dispatch<SetStateAction<boolean | null>>;
  setAdminAccessChecked: Dispatch<SetStateAction<boolean>>;
  setAdminCapabilities: Dispatch<SetStateAction<AdminCapabilities>>;
};

function resolveThemePreference(preference: unknown): ThemeOption {
  if (preference === "light" || preference === "dark" || preference === "system") {
    return preference;
  }
  return "system";
}

function decodeJwtExpiryEpochMs(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) {
      return null;
    }

    const payloadPart = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = payloadPart.padEnd(Math.ceil(payloadPart.length / 4) * 4, "=");
    const payloadText = atob(paddedPayload);
    const payload = JSON.parse(payloadText) as { exp?: unknown };

    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
      return null;
    }

    return payload.exp * 1000;
  } catch {
    return null;
  }
}

export function useSessionAutoRefresh(params: UseSessionAutoRefreshParams) {
  const {
    accessToken,
    refreshToken,
    refreshTokenStorageKey,
    setAccessToken,
    setRefreshToken,
  } = params;

  const accessTokenRef = useRef<string | null>(accessToken);
  const refreshTokenRef = useRef<string | null>(refreshToken);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    refreshTokenRef.current = refreshToken;
  }, [refreshToken]);

  const clearSession = useCallback(() => {
    window.localStorage.removeItem(refreshTokenStorageKey);
    setAccessToken(null);
    setRefreshToken(null);
  }, [refreshTokenStorageKey, setAccessToken, setRefreshToken]);

  const refreshNow = useCallback(async () => {
    const currentRefreshToken = refreshTokenRef.current;
    if (!currentRefreshToken) {
      return;
    }

    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const refreshPromise = refreshSession(currentRefreshToken)
      .then((tokens) => {
        setAccessToken(tokens.accessToken);
        setRefreshToken(tokens.refreshToken);
        window.localStorage.setItem(refreshTokenStorageKey, tokens.refreshToken);
      })
      .catch(() => {
        clearSession();
      })
      .finally(() => {
        refreshInFlightRef.current = null;
      });

    refreshInFlightRef.current = refreshPromise;
    return refreshPromise;
  }, [clearSession, refreshTokenStorageKey, setAccessToken, setRefreshToken]);

  useEffect(() => {
    if (!accessToken || !refreshToken) {
      return;
    }

    let timeoutHandle: number | null = null;
    const refreshLeadMs = 60_000;
    const fallbackRefreshMs = 5 * 60_000;
    const minDelayMs = 5_000;

    const clearTimer = () => {
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    };

    const scheduleNextRefresh = () => {
      clearTimer();

      const currentAccessToken = accessTokenRef.current;
      if (!currentAccessToken) {
        return;
      }

      const expiryMs = decodeJwtExpiryEpochMs(currentAccessToken);
      const nowMs = Date.now();
      const delayMs = expiryMs === null
        ? fallbackRefreshMs
        : Math.max(minDelayMs, expiryMs - nowMs - refreshLeadMs);

      timeoutHandle = window.setTimeout(() => {
        void refreshNow();
      }, delayMs);
    };

    const refreshIfStaleOrSoonExpiring = () => {
      const currentAccessToken = accessTokenRef.current;
      if (!currentAccessToken) {
        return;
      }

      const expiryMs = decodeJwtExpiryEpochMs(currentAccessToken);
      if (expiryMs === null || (expiryMs - Date.now()) <= refreshLeadMs) {
        void refreshNow();
        return;
      }

      scheduleNextRefresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshIfStaleOrSoonExpiring();
      }
    };

    const handleWindowFocus = () => {
      refreshIfStaleOrSoonExpiring();
    };

    const handlePageShow = () => {
      refreshIfStaleOrSoonExpiring();
    };

    scheduleNextRefresh();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      clearTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [accessToken, refreshNow, refreshToken]);
}

export function useClientToastListener(setClientPopups: Dispatch<SetStateAction<ClientPopupToast[]>>) {
  useEffect(() => {
    function onClientToast(event: Event) {
      const customEvent = event as CustomEvent<ClientToastEventDetail>;
      const detail = customEvent.detail;
      if (!detail || !detail.message) {
        return;
      }

      setClientPopups((current) => [
        ...current,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          title: detail.title || "Update",
          message: detail.message,
          severity: detail.severity || "info",
          open: true,
        },
      ]);
    }

    window.addEventListener(CLIENT_TOAST_EVENT, onClientToast as EventListener);
    return () => {
      window.removeEventListener(CLIENT_TOAST_EVENT, onClientToast as EventListener);
    };
  }, [setClientPopups]);
}

export function useSessionRestore(params: UseSessionRestoreParams) {
  const { refreshTokenStorageKey, setAccessToken, setRefreshToken, setRestoringSession } = params;

  useEffect(() => {
    const storedRefreshToken = window.localStorage.getItem(refreshTokenStorageKey);
    if (!storedRefreshToken) {
      setRestoringSession(false);
      return;
    }

    refreshSession(storedRefreshToken)
      .then((tokens) => {
        setAccessToken(tokens.accessToken);
        setRefreshToken(tokens.refreshToken);
        window.localStorage.setItem(refreshTokenStorageKey, tokens.refreshToken);
      })
      .catch(() => {
        window.localStorage.removeItem(refreshTokenStorageKey);
      })
      .finally(() => setRestoringSession(false));
  }, [refreshTokenStorageKey, setAccessToken, setRefreshToken, setRestoringSession]);
}

export function useAuthMeta(params: UseAuthMetaParams) {
  const {
    setAppName,
    setAppIcon,
    setAuthProviders,
    setRegistrationEnabled,
    setRegisterProfilePropertyCatalog,
    setError,
    setAuthMetaLoaded,
  } = params;

  useEffect(() => {
    getAuthProviders()
      .then((payload) => {
        setAppName(payload.appName || DEFAULT_APP_NAME);
        setAppIcon(payload.appIcon || "🧩");
        setAuthProviders(payload.providers || []);
        setRegistrationEnabled(payload.localRegistrationEnabled ?? true);
        setRegisterProfilePropertyCatalog(Array.isArray(payload.profilePropertyCatalog) ? payload.profilePropertyCatalog : []);
      })
      .catch((metaError) => {
        setError(metaError instanceof Error ? metaError.message : "Unable to load auth options");
      })
      .finally(() => setAuthMetaLoaded(true));
  }, [setAppName, setAppIcon, setAuthProviders, setRegistrationEnabled, setRegisterProfilePropertyCatalog, setError, setAuthMetaLoaded]);
}

export function useProfileAndAdminBootstrap(params: UseProfileAndAdminBootstrapParams) {
  const {
    accessToken,
    setCurrentUsername,
    setTheme,
    setCanAccessAdmin,
    setAdminAccessChecked,
    setAdminCapabilities,
  } = params;

  useEffect(() => {
    if (!accessToken) {
      setCurrentUsername("User");
      setCanAccessAdmin(false);
      setAdminAccessChecked(false);
      setAdminCapabilities(getEmptyAdminCapabilities());
      return;
    }

    setCanAccessAdmin(null);
    setAdminAccessChecked(false);

    getMyProfile(accessToken)
      .then((profile) => {
        const username = profile?.displayName || profile?.username || profile?.email || "User";
        setCurrentUsername(username);
        const baseTheme = resolveThemePreference(profile?.preferences?.theme);
        const overrideTheme = resolveProfileThemePreferenceOverride(profile?.preferences?.theme);
        setTheme(overrideTheme || baseTheme);
      })
      .catch(() => {
        setCurrentUsername("User");
        setTheme("system");
      });

    getAdminCapabilities(accessToken)
      .then((capabilities) => {
        setCanAccessAdmin(capabilities.anyAdmin);
        setAdminCapabilities(mapApiAdminCapabilitiesToApp(capabilities));
        setAdminAccessChecked(true);
      })
      .catch(() => {
        setCanAccessAdmin(false);
        setAdminCapabilities(getEmptyAdminCapabilities());
        setAdminAccessChecked(true);
      });
  }, [accessToken, setAdminAccessChecked, setAdminCapabilities, setCanAccessAdmin, setCurrentUsername, setTheme]);
}
