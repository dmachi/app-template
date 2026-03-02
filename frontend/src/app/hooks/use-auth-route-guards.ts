import { useEffect } from "react";

import { getSettingsExtensions } from "../../extensions/settings-registry";
import type { AdminCapabilities } from "./types";

type UseRouteGuardsParams = {
  restoringSession: boolean;
  accessToken: string | null;
  canAccessAdmin: boolean | null;
  adminAccessChecked: boolean;
  adminCapabilities: AdminCapabilities;
  locationPathname: string;
  selectedGroupId: string | null;
  selectedExtensionId: string | null;
  navigateTo: (to: string, replace?: boolean) => void;
};

function getFirstAllowedAdminPath(capabilities: AdminCapabilities): string | null {
  if (capabilities.content) {
    return "/settings/admin/content";
  }
  if (capabilities.users) {
    return "/settings/admin/users";
  }
  if (capabilities.invitations) {
    return "/settings/admin/invitations";
  }
  if (capabilities.roles) {
    return "/settings/admin/roles";
  }
  if (capabilities.groups) {
    return "/settings/groups";
  }
  return null;
}

function canAccessAdminPath(pathname: string, capabilities: AdminCapabilities): boolean {
  if (pathname === "/settings/admin") {
    return capabilities.users;
  }
  if (pathname === "/settings/admin/users" || pathname.startsWith("/settings/admin/users/")) {
    return capabilities.users;
  }
  if (pathname === "/settings/admin/invitations") {
    return capabilities.invitations;
  }
  if (pathname === "/settings/admin/notifications") {
    return capabilities.roles;
  }
  if (pathname === "/settings/admin/roles") {
    return capabilities.roles;
  }
  if (pathname === "/settings/admin/content" || pathname.startsWith("/settings/admin/content/")) {
    return capabilities.content;
  }
  if (pathname === "/settings/admin/media") {
    return capabilities.content;
  }
  if (pathname === "/settings/admin/content-types") {
    return capabilities.contentTypes;
  }
  return true;
}

function isAdminPath(pathname: string): boolean {
  return pathname === "/settings/admin" || pathname.startsWith("/settings/admin/");
}

function isPublicUnauthenticatedPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/login" || pathname === "/register" || pathname === "/verify-email" || pathname === "/accept-invite") {
    return true;
  }
  if (pathname.startsWith("/settings")) {
    return false;
  }
  return true;
}

const ROUTE_DEBUG_ENABLED = import.meta.env.DEV && import.meta.env.VITE_ROUTE_DEBUG === "true";

function debugRouteGuard(message: string, payload?: Record<string, unknown>) {
  if (!ROUTE_DEBUG_ENABLED) {
    return;
  }
  if (payload) {
    console.debug(message, payload);
    return;
  }
  console.debug(message);
}

export function useRouteGuards(params: UseRouteGuardsParams) {
  const {
    restoringSession,
    accessToken,
    canAccessAdmin,
    adminAccessChecked,
    adminCapabilities,
    locationPathname,
    selectedGroupId,
    selectedExtensionId,
    navigateTo,
  } = params;

  useEffect(() => {
    debugRouteGuard("[route-debug] auth-guard:enter", {
      restoringSession,
      accessTokenPresent: Boolean(accessToken),
      canAccessAdmin,
      adminAccessChecked,
      pathname: locationPathname,
    });

    if (restoringSession) {
      debugRouteGuard("[route-debug] auth-guard:skip restoringSession");
      return;
    }

    if (!accessToken) {
      debugRouteGuard("[route-debug] auth-guard:skip no-access-token");
      return;
    }

    const settingsExtensions = getSettingsExtensions({ canAccessAdmin: Boolean(canAccessAdmin), adminCapabilities });
    const selectedExtension = selectedExtensionId ? settingsExtensions.find((item) => item.id === selectedExtensionId) : null;
    const groupDetailPathMatch = /^\/settings\/group\/([^/]+)$/.exec(locationPathname);
    const selectedGroupIdFromPath = groupDetailPathMatch?.[1] ?? null;

    if (locationPathname.startsWith("/settings/group/") && !selectedGroupIdFromPath) {
      debugRouteGuard("[route-debug] auth-guard:redirect invalid-group-detail", {
        pathname: locationPathname,
        selectedGroupId,
        selectedGroupIdFromPath,
        target: "/settings/groups",
      });
      navigateTo("/settings/groups", true);
      return;
    }

    if (locationPathname.startsWith("/settings/extensions/") && !selectedExtension) {
      navigateTo("/settings/profile", true);
      return;
    }

    if (locationPathname === "/login" || locationPathname === "/register") {
      debugRouteGuard("[route-debug] auth-guard:redirect auth-page-while-authenticated", {
        pathname: locationPathname,
        target: "/",
      });
      navigateTo("/", true);
      return;
    }

    if (locationPathname === "/verify-email" || locationPathname === "/accept-invite") {
      return;
    }

    if (isAdminPath(locationPathname)) {
      if (!adminAccessChecked) {
        debugRouteGuard("[route-debug] auth-guard:wait admin-access-check", {
          pathname: locationPathname,
        });
        return;
      }
      if (!canAccessAdmin) {
        debugRouteGuard("[route-debug] auth-guard:redirect admin-denied", {
          pathname: locationPathname,
          target: "/",
        });
        navigateTo("/", true);
        return;
      }
      if (!canAccessAdminPath(locationPathname, adminCapabilities)) {
        const fallbackPath = getFirstAllowedAdminPath(adminCapabilities);
        if (fallbackPath) {
          navigateTo(fallbackPath, true);
        } else {
          navigateTo("/", true);
        }
        return;
      }
      debugRouteGuard("[route-debug] auth-guard:admin-route-resolved", {
        pathname: locationPathname,
        canAccessAdmin,
      });
      return;
    }

    debugRouteGuard("[route-debug] auth-guard:allow", {
      pathname: locationPathname,
    });
  }, [
    accessToken,
    adminAccessChecked,
    adminCapabilities,
    canAccessAdmin,
    locationPathname,
    navigateTo,
    restoringSession,
    selectedExtensionId,
    selectedGroupId,
  ]);

  useEffect(() => {
    debugRouteGuard("[route-debug] public-guard:enter", {
      restoringSession,
      accessTokenPresent: Boolean(accessToken),
      pathname: locationPathname,
    });

    if (restoringSession) {
      debugRouteGuard("[route-debug] public-guard:skip restoringSession");
      return;
    }

    if (accessToken) {
      debugRouteGuard("[route-debug] public-guard:skip authenticated");
      return;
    }

    if (!isPublicUnauthenticatedPath(locationPathname)) {
      debugRouteGuard("[route-debug] public-guard:redirect invalid-public-path", {
        pathname: locationPathname,
        target: "/",
      });
      navigateTo("/", true);
    }
  }, [accessToken, locationPathname, navigateTo, restoringSession]);
}
