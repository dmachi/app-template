import { Dispatch, SetStateAction, useEffect } from "react";

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
