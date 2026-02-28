import { useState } from "react";

import { useAuthMeta } from "./use-app-bootstrap";
import type { AuthProviderMeta, ProfilePropertyCatalogItem } from "../../lib/api";

export function useAppAuthMetaState() {
  const [appName, setAppName] = useState("Basic System Template");
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