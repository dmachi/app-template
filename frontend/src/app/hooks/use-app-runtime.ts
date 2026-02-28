import { Dispatch, SetStateAction, useEffect } from "react";

import { getSettingsExtensions } from "../../extensions/settings-registry";
import { NotificationItem } from "../../lib/api";

type AdminCapabilities = {
  users: boolean;
  groups: boolean;
  invitations: boolean;
  roles: boolean;
};

type RealtimeNotificationToast = {
  id: string;
  message: string;
  severity: "info" | "success" | "warning" | "error";
  clearanceMode: string;
  requiresAcknowledgement: boolean;
  openEndpoint: string | null;
  open: boolean;
};

type UseRealtimeNotificationsParams = {
  accessToken: string | null;
  locationPathname: string;
  apiBase: string;
  refreshHomeNotifications: (token: string) => Promise<void>;
  setRealtimePopups: Dispatch<SetStateAction<RealtimeNotificationToast[]>>;
  setHomeNotifications: Dispatch<SetStateAction<NotificationItem[]>>;
  setNotificationRefreshSignal: Dispatch<SetStateAction<number>>;
};

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
  return true;
}

function isAdminPath(pathname: string): boolean {
  return pathname === "/settings/admin" || pathname.startsWith("/settings/admin/");
}

function isPublicUnauthenticatedPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/login" || pathname === "/register" || pathname === "/verify-email" || pathname === "/accept-invite";
}

export function useRealtimeNotifications(params: UseRealtimeNotificationsParams) {
  const { accessToken, locationPathname, apiBase, refreshHomeNotifications, setRealtimePopups, setHomeNotifications, setNotificationRefreshSignal } = params;

  useEffect(() => {
    if (!accessToken) {
      setRealtimePopups([]);
      setHomeNotifications([]);
      return;
    }

    refreshHomeNotifications(accessToken).catch(() => {});

    const wsBase = apiBase.replace(/^http/i, "ws");
    const socket = new WebSocket(`${wsBase}/ws/events?token=${encodeURIComponent(accessToken)}`);
    const timers = new Map<string, number>();

    socket.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data) as {
          eventType?: string;
          payload?: {
            id?: string;
            message?: string;
            severity?: string;
            clearanceMode?: string;
            requiresAcknowledgement?: boolean;
            openEndpoint?: string | null;
          };
        };
        if (envelope.eventType !== "notification.created" && envelope.eventType !== "notification.updated") {
          return;
        }

        const payload = envelope.payload;
        if (!payload?.id || !payload.message) {
          return;
        }

        const severity: RealtimeNotificationToast["severity"] =
          payload.severity === "success" || payload.severity === "warning" || payload.severity === "error" ? payload.severity : "info";
        const popupId = payload.id;
        setNotificationRefreshSignal((current) => current + 1);

        if (locationPathname === "/") {
          refreshHomeNotifications(accessToken).catch(() => {});
        } else {
          setRealtimePopups((current) => {
            const withoutSame = current.filter((item) => item.id !== popupId);
            return [
              {
                id: popupId,
                message: payload.message as string,
                severity,
                clearanceMode: payload.clearanceMode ?? "manual",
                requiresAcknowledgement: Boolean(payload.requiresAcknowledgement),
                openEndpoint: payload.openEndpoint ?? null,
                open: true,
              },
              ...withoutSame,
            ].slice(0, 3);
          });
        }

        const actionable = (payload.clearanceMode === "ack" && Boolean(payload.requiresAcknowledgement)) || payload.clearanceMode === "task_gate";
        if (!actionable) {
          const existingTimer = timers.get(popupId);
          if (typeof existingTimer === "number") {
            window.clearTimeout(existingTimer);
          }
          const timerId = window.setTimeout(() => {
            setRealtimePopups((current) => current.map((item) => (item.id === popupId ? { ...item, open: false } : item)));
            timers.delete(popupId);
          }, 5000);
          timers.set(popupId, timerId);
        }
      } catch {
        return;
      }
    };

    return () => {
      for (const timerId of timers.values()) {
        window.clearTimeout(timerId);
      }
      socket.close();
    };
  }, [accessToken, apiBase, locationPathname, refreshHomeNotifications, setHomeNotifications, setNotificationRefreshSignal, setRealtimePopups]);
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
    console.debug("[route-debug] auth-guard:enter", {
      restoringSession,
      accessTokenPresent: Boolean(accessToken),
      canAccessAdmin,
      adminAccessChecked,
      pathname: locationPathname,
    });

    if (restoringSession) {
      console.debug("[route-debug] auth-guard:skip restoringSession");
      return;
    }

    if (!accessToken) {
      console.debug("[route-debug] auth-guard:skip no-access-token");
      return;
    }

    const settingsExtensions = getSettingsExtensions({ canAccessAdmin: Boolean(canAccessAdmin), adminCapabilities });
    const selectedExtension = selectedExtensionId ? settingsExtensions.find((item) => item.id === selectedExtensionId) : null;

    if (locationPathname.startsWith("/settings/group/") && !selectedGroupId) {
      console.debug("[route-debug] auth-guard:redirect invalid-group-detail", {
        pathname: locationPathname,
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
      console.debug("[route-debug] auth-guard:redirect auth-page-while-authenticated", {
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
        console.debug("[route-debug] auth-guard:wait admin-access-check", {
          pathname: locationPathname,
        });
        return;
      }
      if (!canAccessAdmin) {
        console.debug("[route-debug] auth-guard:redirect admin-denied", {
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
      console.debug("[route-debug] auth-guard:admin-route-resolved", {
        pathname: locationPathname,
        canAccessAdmin,
      });
      return;
    }

    console.debug("[route-debug] auth-guard:allow", {
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
    console.debug("[route-debug] public-guard:enter", {
      restoringSession,
      accessTokenPresent: Boolean(accessToken),
      pathname: locationPathname,
    });

    if (restoringSession) {
      console.debug("[route-debug] public-guard:skip restoringSession");
      return;
    }

    if (accessToken) {
      console.debug("[route-debug] public-guard:skip authenticated");
      return;
    }

    if (!isPublicUnauthenticatedPath(locationPathname)) {
      console.debug("[route-debug] public-guard:redirect invalid-public-path", {
        pathname: locationPathname,
        target: "/",
      });
      navigateTo("/", true);
    }
  }, [accessToken, locationPathname, navigateTo, restoringSession]);
}
