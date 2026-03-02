import { useState } from "react";

import { useAuthMeta } from "./use-app-bootstrap";
import type { AuthProviderMeta, ProfilePropertyCatalogItem } from "../../lib/api";

const DEFAULT_APP_NAME = import.meta.env.VITE_APP_NAME?.trim() || "Basic System Template";

export function useAppAuthMetaState() {
  const [appName, setAppName] = useState(DEFAULT_APP_NAME);
  const [appIcon, setAppIcon] = useState("🧩");
  const [authProviders, setAuthProviders] = useState<AuthProviderMeta[]>([]);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [authMetaLoaded, setAuthMetaLoaded] = useState(false);
  const [registerProfilePropertyCatalog, setRegisterProfilePropertyCatalog] = useState<ProfilePropertyCatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useAuthMeta({
    setAppName,
    setAppIcon,
    setAuthProviders,
    setRegistrationEnabled,
    setRegisterProfilePropertyCatalog,
    setError,
    setAuthMetaLoaded,
  });

  return {
    appName,
    appIcon,
    authProviders,
    registrationEnabled,
    authMetaLoaded,
    registerProfilePropertyCatalog,
    error,
    setError,
  };
}