import { FormEvent, useEffect, useState } from "react";

import { AuthMenu } from "./components/shared/auth-menu";
import { InviteUsersDialog } from "./components/shared/invite-users-dialog";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "./components/ui/toast";
import { AdminInvitationsPage } from "./pages/admin-invitations-page";
import { AdminNotificationsPage } from "./pages/admin-notifications-page";
import { AdminRolesPage } from "./pages/admin-roles-page";
import { AdminUserDetailPage } from "./pages/admin-user-detail-page";
import { AdminUsersPage } from "./pages/admin-users-page";
import { AcceptInvitePage } from "./pages/accept-invite-page";
import { getSettingsExtensions } from "./extensions/settings-registry";
import { GroupDetailPage } from "./pages/group-detail-page";
import { GroupsPage } from "./pages/groups-page";
import { NotificationsPage } from "./pages/notifications-page";
import { ProfilePage } from "./pages/profile-page";
import { SecurityPage } from "./pages/security-page";
import { ThemePage } from "./pages/theme-page";
import { VerifyEmailPage } from "./pages/verify-email-page";
import {
  API_BASE,
  acceptInvitation,
  acknowledgeNotification,
  getAdminCapabilities,
  getAuthProviders,
  getMyProfile,
  listMyNotifications,
  login,
  markNotificationRead,
  logout,
  refreshSession,
  register,
  startRedirectProvider,
  type AuthProviderMeta,
  type NotificationItem,
  type ProfilePropertyCatalogItem,
  type ProfilePropertyLinkItem,
} from "./lib/api";

type RealtimeNotificationToast = {
  id: string;
  message: string;
  severity: "info" | "success" | "warning" | "error";
  clearanceMode: string;
  requiresAcknowledgement: boolean;
  openEndpoint: string | null;
  open: boolean;
};

function isActionRequiredToast(toast: RealtimeNotificationToast): boolean {
  return (toast.clearanceMode === "ack" && toast.requiresAcknowledgement) || toast.clearanceMode === "task_gate";
}
type View =
  | "home"
  | "login"
  | "register"
  | "accept-invite"
  | "verify-email"
  | "profile"
  | "notifications"
  | "security"
  | "groups"
  | "group-detail"
  | "extension"
  | "theme"
  | "admin-notifications"
  | "admin-invitations"
  | "admin-users"
  | "admin-user-detail"
  | "admin-roles";
type ThemeOption = "light" | "dark" | "system";
const REFRESH_TOKEN_STORAGE_KEY = "bst.refreshToken";
const INVITE_TOKEN_STORAGE_KEY = "bst.pendingInviteToken";

function normalizePathname(pathname: string): string {
  if (pathname !== "/" && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function parseSettingsRoute(pathname: string): { view: View; groupId: string | null; adminUserId: string | null; extensionId: string | null } {
  pathname = normalizePathname(pathname);

  if (pathname === "/") {
    return { view: "home", groupId: null, adminUserId: null, extensionId: null };
  }
  if (pathname === "/settings") {
    return { view: "profile", groupId: null, adminUserId: null, extensionId: null };
  }
  if (pathname === "/login") {
    return { view: "login", groupId: null, adminUserId: null, extensionId: null };
  }
  if (pathname === "/register") {
    return { view: "register", groupId: null, adminUserId: null, extensionId: null };
  }
  if (pathname === "/verify-email") {
    return { view: "verify-email", groupId: null, adminUserId: null, extensionId: null };
  }
  if (pathname === "/accept-invite") {
    return { view: "accept-invite", groupId: null, adminUserId: null, extensionId: null };
  }
  if (pathname === "/settings/profile") {
    return { view: "profile", groupId: null, adminUserId: null, extensionId: null };
  }
  if (pathname === "/settings/notifications") {
    return { view: "notifications", groupId: null, adminUserId: null, extensionId: null };
  }
  if (pathname === "/settings/security") {
    return { view: "security", groupId: null, adminUserId: null, extensionId: null };
  }
  if (pathname === "/settings/groups") {
    return { view: "groups", groupId: null, adminUserId: null, extensionId: null };
  }
  if (pathname === "/settings/theme") {
    return { view: "theme", groupId: null, adminUserId: null, extensionId: null };
  }
  if (pathname === "/settings/admin/users") {
    return { view: "admin-users", groupId: null, adminUserId: null, extensionId: null };
  }
  if (pathname === "/settings/admin/invitations") {
    return { view: "admin-invitations", groupId: null, adminUserId: null, extensionId: null };
  }
  if (pathname === "/settings/admin/notifications") {
    return { view: "admin-notifications", groupId: null, adminUserId: null, extensionId: null };
  }
  if (pathname === "/settings/admin/roles") {
    return { view: "admin-roles", groupId: null, adminUserId: null, extensionId: null };
  }
  if (pathname === "/admin") {
    return { view: "admin-users", groupId: null, adminUserId: null, extensionId: null };
  }
  if (pathname === "/invitations") {
    return { view: "admin-invitations", groupId: null, adminUserId: null, extensionId: null };
  }
  if (pathname === "/admin/users") {
    return { view: "admin-users", groupId: null, adminUserId: null, extensionId: null };
  }
  if (pathname === "/admin/roles") {
    return { view: "admin-roles", groupId: null, adminUserId: null, extensionId: null };
  }
  const adminUserMatch = pathname.match(/^\/admin\/users\/([^/]+)$/);
  if (adminUserMatch) {
    return { view: "admin-user-detail", groupId: null, adminUserId: adminUserMatch[1], extensionId: null };
  }
  const settingsAdminUserMatch = pathname.match(/^\/settings\/admin\/users\/([^/]+)$/);
  if (settingsAdminUserMatch) {
    return { view: "admin-user-detail", groupId: null, adminUserId: settingsAdminUserMatch[1], extensionId: null };
  }
  const groupMatch = pathname.match(/^\/settings\/group\/([^/]+)$/);
  if (groupMatch) {
    return { view: "group-detail", groupId: groupMatch[1], adminUserId: null, extensionId: null };
  }
  const extensionMatch = pathname.match(/^\/settings\/extensions\/([^/]+)$/);
  if (extensionMatch) {
    return { view: "extension", groupId: null, adminUserId: null, extensionId: extensionMatch[1] };
  }
  return { view: "home", groupId: null, adminUserId: null, extensionId: null };
}

function buildSettingsPath(view: View, groupId: string | null, adminUserId: string | null, extensionId: string | null): string {
  if (view === "home") {
    return "/";
  }
  if (view === "profile") {
    return "/settings/profile";
  }
  if (view === "notifications") {
    return "/settings/notifications";
  }
  if (view === "login") {
    return "/login";
  }
  if (view === "register") {
    return "/register";
  }
  if (view === "verify-email") {
    return "/verify-email";
  }
  if (view === "accept-invite") {
    return "/accept-invite";
  }
  if (view === "groups") {
    return "/settings/groups";
  }
  if (view === "security") {
    return "/settings/security";
  }
  if (view === "theme") {
    return "/settings/theme";
  }
  if (view === "admin-users") {
    return "/settings/admin/users";
  }
  if (view === "admin-invitations") {
    return "/settings/admin/invitations";
  }
  if (view === "admin-notifications") {
    return "/settings/admin/notifications";
  }
  if (view === "admin-user-detail" && adminUserId) {
    return `/settings/admin/users/${adminUserId}`;
  }
  if (view === "admin-roles") {
    return "/settings/admin/roles";
  }
  if (view === "group-detail" && groupId) {
    return `/settings/group/${groupId}`;
  }
  if (view === "extension" && extensionId) {
    return `/settings/extensions/${extensionId}`;
  }
  return "/";
}

export function App() {
  const [appName, setAppName] = useState("Basic System Template");
  const [appIcon, setAppIcon] = useState("🧩");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [restoringSession, setRestoringSession] = useState(true);
  const [view, setView] = useState<View>("home");
  const [currentUsername, setCurrentUsername] = useState<string>("User");
  const [theme, setTheme] = useState<ThemeOption>("system");
  const [canAccessAdmin, setCanAccessAdmin] = useState<boolean | null>(null);
  const [adminAccessChecked, setAdminAccessChecked] = useState(false);
  const [adminCapabilities, setAdminCapabilities] = useState<{ users: boolean; groups: boolean; invitations: boolean; roles: boolean }>({
    users: false,
    groups: false,
    invitations: false,
    roles: false,
  });
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedAdminUserId, setSelectedAdminUserId] = useState<string | null>(null);
  const [selectedExtensionId, setSelectedExtensionId] = useState<string | null>(null);
  const [emailVerificationToken, setEmailVerificationToken] = useState<string | null>(null);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [pendingInvitationToken, setPendingInvitationToken] = useState<string | null>(null);
  const [acceptingInvitation, setAcceptingInvitation] = useState(false);
  const [invitationAcceptanceMessage, setInvitationAcceptanceMessage] = useState<string | null>(null);
  const [authProviders, setAuthProviders] = useState<AuthProviderMeta[]>([]);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [authMetaLoaded, setAuthMetaLoaded] = useState(false);
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerDisplayName, setRegisterDisplayName] = useState("");
  const [registerProfilePropertyCatalog, setRegisterProfilePropertyCatalog] = useState<ProfilePropertyCatalogItem[]>([]);
  const [registerProfileProperties, setRegisterProfileProperties] = useState<Record<string, unknown>>({});
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimePopups, setRealtimePopups] = useState<RealtimeNotificationToast[]>([]);
  const [homeNotifications, setHomeNotifications] = useState<NotificationItem[]>([]);
  const [notificationRefreshSignal, setNotificationRefreshSignal] = useState(0);

  async function refreshHomeNotifications(token: string) {
    const payload = await listMyNotifications(token);
    const actionable = payload.items.filter((notification) => {
      if (notification.status === "cleared" || notification.canceledAt) {
        return false;
      }
      if (notification.clearanceMode === "ack") {
        return !notification.acknowledgedAt;
      }
      return notification.clearanceMode === "task_gate";
    });
    setHomeNotifications(actionable);
  }

  async function onHomeAcknowledge(notificationId: string) {
    if (!accessToken) {
      return;
    }
    try {
      await acknowledgeNotification(accessToken, notificationId);
      await refreshHomeNotifications(accessToken);
      setNotificationRefreshSignal((current) => current + 1);
    } catch {
      return;
    }
  }

  function onOpenTask(notification: NotificationItem) {
    if (notification.openEndpoint) {
      window.location.assign(notification.openEndpoint);
      return;
    }
    navigateSettings("notifications");
  }

  function removeToast(toastId: string) {
    setRealtimePopups((current) => current.filter((item) => item.id !== toastId));
  }

  async function onToastManualClose(toastId: string) {
    if (accessToken) {
      try {
        await markNotificationRead(accessToken, toastId);
      } catch {
        // ignore read-mark failures for temporary notification UI behavior
      }
      setNotificationRefreshSignal((current) => current + 1);
    }
    removeToast(toastId);
  }

  async function onToastAcknowledge(toastId: string) {
    if (!accessToken) {
      removeToast(toastId);
      return;
    }
    try {
      await acknowledgeNotification(accessToken, toastId);
    } catch {
      // ignore ack failures for temporary notification UI behavior
    }
    setNotificationRefreshSignal((current) => current + 1);
    removeToast(toastId);
  }

  async function onToastOpenTask(toast: RealtimeNotificationToast) {
    if (accessToken) {
      try {
        await markNotificationRead(accessToken, toast.id);
      } catch {
        // ignore read-mark failures before navigation
      }
      setNotificationRefreshSignal((current) => current + 1);
    }
    removeToast(toast.id);
    if (toast.openEndpoint) {
      window.location.assign(toast.openEndpoint);
      return;
    }
    navigateSettings("notifications");
  }

  function resolveThemePreference(preference: unknown): ThemeOption {
    if (preference === "light" || preference === "dark" || preference === "system") {
      return preference;
    }
    return "system";
  }

  function applyTheme(nextTheme: ThemeOption) {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = nextTheme === "dark" || (nextTheme === "system" && prefersDark);
    document.documentElement.classList.toggle("dark", shouldUseDark);
    document.documentElement.style.colorScheme = shouldUseDark ? "dark" : "light";
  }

  function getFirstAllowedAdminView(capabilities: { users: boolean; groups: boolean; invitations: boolean; roles: boolean }): View | null {
    if (capabilities.users) {
      return "admin-users";
    }
    if (capabilities.invitations) {
      return "admin-invitations";
    }
    if (capabilities.roles) {
      return "admin-roles";
    }
    if (capabilities.groups) {
      return "groups";
    }
    return null;
  }

  function canAccessAdminView(nextView: View, capabilities: { users: boolean; groups: boolean; invitations: boolean; roles: boolean }): boolean {
    if (nextView === "admin-users" || nextView === "admin-user-detail") {
      return capabilities.users;
    }
    if (nextView === "admin-invitations") {
      return capabilities.invitations;
    }
    if (nextView === "admin-notifications") {
      return capabilities.roles;
    }
    if (nextView === "admin-roles") {
      return capabilities.roles;
    }
    return true;
  }

  useEffect(() => {
    const storedRefreshToken = window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    if (!storedRefreshToken) {
      setRestoringSession(false);
      return;
    }

    refreshSession(storedRefreshToken)
      .then((tokens) => {
        setAccessToken(tokens.accessToken);
        setRefreshToken(tokens.refreshToken);
        window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken);
      })
      .catch(() => {
        window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
      })
      .finally(() => setRestoringSession(false));
  }, []);

  useEffect(() => {
    applyTheme(theme);

    if (theme !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system");
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  useEffect(() => {
    const syncFromLocation = () => {
      console.debug("[route-debug] syncFromLocation:start", {
        pathname: window.location.pathname,
        restoringSession,
        accessTokenPresent: Boolean(accessToken),
      });

      const normalizedPath = normalizePathname(window.location.pathname);
      if (normalizedPath !== window.location.pathname) {
        console.debug("[route-debug] normalizePathname", {
          from: window.location.pathname,
          to: normalizedPath,
        });
        window.history.replaceState({}, "", normalizedPath);
      }

      if (normalizedPath === "/settings") {
        console.debug("[route-debug] canonical redirect", { from: "/settings", to: "/settings/profile" });
        window.history.replaceState({}, "", "/settings/profile");
      }
      if (normalizedPath === "/admin") {
        console.debug("[route-debug] canonical redirect", { from: "/admin", to: "/settings/admin/users" });
        window.history.replaceState({}, "", "/settings/admin/users");
      }
      if (normalizedPath === "/admin/users") {
        window.history.replaceState({}, "", "/settings/admin/users");
      }
      if (normalizedPath === "/admin/roles") {
        window.history.replaceState({}, "", "/settings/admin/roles");
      }
      if (normalizedPath === "/admin/groups") {
        window.history.replaceState({}, "", "/settings/groups");
      }
      if (normalizedPath === "/invitations") {
        window.history.replaceState({}, "", "/settings/admin/invitations");
      }
      const { view: nextView, groupId, adminUserId, extensionId } = parseSettingsRoute(window.location.pathname);
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const inviteToken = params.get("inviteToken");
      const storedPendingInviteToken = window.localStorage.getItem(INVITE_TOKEN_STORAGE_KEY);
      console.debug("[route-debug] syncFromLocation:parsed", {
        pathname: window.location.pathname,
        nextView,
        groupId,
        adminUserId,
        extensionId,
        tokenPresent: Boolean(token),
        inviteTokenPresent: Boolean(inviteToken),
        storedPendingInviteTokenPresent: Boolean(storedPendingInviteToken),
      });
      setView(nextView);
      setSelectedGroupId(groupId);
      setSelectedAdminUserId(adminUserId);
      setSelectedExtensionId(extensionId);
      setEmailVerificationToken(nextView === "verify-email" ? token : null);
      setInvitationToken(nextView === "accept-invite" ? token : null);

      if (nextView === "accept-invite" && token) {
        setPendingInvitationToken(token);
        window.localStorage.setItem(INVITE_TOKEN_STORAGE_KEY, token);
      } else if (inviteToken) {
        setPendingInvitationToken(inviteToken);
        window.localStorage.setItem(INVITE_TOKEN_STORAGE_KEY, inviteToken);
      } else if (storedPendingInviteToken) {
        setPendingInvitationToken(storedPendingInviteToken);
      }
    };

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => {
      window.removeEventListener("popstate", syncFromLocation);
    };
  }, []);

  useEffect(() => {
    getAuthProviders()
      .then((payload) => {
        setAppName(payload.appName || "Basic System Template");
        setAppIcon(payload.appIcon || "🧩");
        setAuthProviders(payload.providers || []);
        setRegistrationEnabled(payload.localRegistrationEnabled ?? true);
        setRegisterProfilePropertyCatalog(Array.isArray(payload.profilePropertyCatalog) ? payload.profilePropertyCatalog : []);
      })
      .catch((metaError) => {
        setError(metaError instanceof Error ? metaError.message : "Unable to load auth options");
      })
      .finally(() => setAuthMetaLoaded(true));
  }, []);

  function getRegisterLinkItems(key: string): ProfilePropertyLinkItem[] {
    const value = registerProfileProperties[key];
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((item): item is ProfilePropertyLinkItem => Boolean(item) && typeof item === "object" && "label" in item && "url" in item)
      .map((item) => ({ label: String(item.label ?? ""), url: String(item.url ?? "") }));
  }

  useEffect(() => {
    if (!accessToken) {
      setCurrentUsername("User");
      setCanAccessAdmin(false);
      setAdminAccessChecked(false);
      setAdminCapabilities({ users: false, groups: false, invitations: false, roles: false });
      return;
    }

    setCanAccessAdmin(null);
    setAdminAccessChecked(false);

    getMyProfile(accessToken)
      .then((profile) => {
        const username = profile?.displayName || profile?.username || profile?.email || "User";
        setCurrentUsername(username);
        setTheme(resolveThemePreference(profile?.preferences?.theme));
      })
      .catch(() => {
        setCurrentUsername("User");
        setTheme("system");
      });

    getAdminCapabilities(accessToken)
      .then((capabilities) => {
        setCanAccessAdmin(capabilities.anyAdmin);
        setAdminCapabilities({
          users: capabilities.users,
          groups: capabilities.groups,
          invitations: capabilities.invitations,
          roles: capabilities.roles,
        });
        setAdminAccessChecked(true);
      })
      .catch(() => {
        setCanAccessAdmin(false);
        setAdminCapabilities({ users: false, groups: false, invitations: false, roles: false });
        setAdminAccessChecked(true);
      });
  }, [accessToken]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const tokens = await login(usernameOrEmail, password);
      setAccessToken(tokens.accessToken);
      setRefreshToken(tokens.refreshToken);
      window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken);
      setPassword("");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to login");
    }
  }

  async function handleRegister(event: FormEvent) {
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
        window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, response.refreshToken);
        navigateSettings("home");
        setError("Registration successful. You are signed in. Please verify your email from the link we sent.");
        return;
      }

      navigateSettings("login");
      setUsernameOrEmail(registerUsername || registerEmail);
      setPassword("");
      setError("Registration successful. Check your email for a verification link before logging in.");
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : "Unable to register");
    }
  }

  async function handleProviderStart(providerId: string) {
    setError(null);
    try {
      if (pendingInvitationToken) {
        window.localStorage.setItem(INVITE_TOKEN_STORAGE_KEY, pendingInvitationToken);
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
  }

  async function handleLogout() {
    try {
      if (refreshToken) {
        await logout(refreshToken);
      }
    } catch {
    } finally {
      window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
      setAccessToken(null);
      setRefreshToken(null);
      setCurrentUsername("User");
      setTheme("system");
      setPassword("");
      setView("home");
      setSelectedGroupId(null);
      setSelectedAdminUserId(null);
      setEmailVerificationToken(null);
      setInvitationToken(null);
      setPendingInvitationToken(null);
      setAcceptingInvitation(false);
      setInvitationAcceptanceMessage(null);
      setAdminCapabilities({ users: false, groups: false, invitations: false, roles: false });
      setInviteDialogOpen(false);
      window.localStorage.removeItem(INVITE_TOKEN_STORAGE_KEY);
      window.history.replaceState({}, "", "/");
    }
  }

  function navigateToAuthWithInvite(nextView: "login" | "register") {
    const path = buildSettingsPath(nextView, null, null, null);
    const params = new URLSearchParams();
    if (pendingInvitationToken) {
      params.set("inviteToken", pendingInvitationToken);
    }
    const target = params.toString() ? `${path}?${params.toString()}` : path;
    window.history.pushState({}, "", target);
    setView(nextView);
    setSelectedGroupId(null);
    setSelectedAdminUserId(null);
    setEmailVerificationToken(null);
    setInvitationToken(null);
  }

  function navigateSettings(nextView: View, groupId: string | null = null, replace = false, adminUserId: string | null = null) {
    const path = buildSettingsPath(nextView, groupId, adminUserId, null);
    if (replace) {
      window.history.replaceState({}, "", path);
    } else {
      window.history.pushState({}, "", path);
    }
    setView(nextView);
    setSelectedGroupId(groupId);
    setSelectedAdminUserId(adminUserId);
    setSelectedExtensionId(null);
    setEmailVerificationToken(null);
  }

  function navigateExtensionSettings(extensionId: string, replace = false) {
    const path = buildSettingsPath("extension", null, null, extensionId);
    if (replace) {
      window.history.replaceState({}, "", path);
    } else {
      window.history.pushState({}, "", path);
    }
    setView("extension");
    setSelectedGroupId(null);
    setSelectedAdminUserId(null);
    setSelectedExtensionId(extensionId);
    setEmailVerificationToken(null);
  }

  useEffect(() => {
    if (!accessToken || !pendingInvitationToken || acceptingInvitation) {
      return;
    }

    setAcceptingInvitation(true);
    setInvitationAcceptanceMessage("Accepting invitation...");

    acceptInvitation(accessToken, pendingInvitationToken)
      .then(() => {
        setInvitationAcceptanceMessage("Invitation accepted. Group membership has been updated.");
        setPendingInvitationToken(null);
        setInvitationToken(null);
        window.localStorage.removeItem(INVITE_TOKEN_STORAGE_KEY);
        if (view === "accept-invite") {
          navigateSettings("home", null, true);
        }
      })
      .catch((inviteError) => {
        setInvitationAcceptanceMessage(inviteError instanceof Error ? inviteError.message : "Unable to accept invitation");
      })
      .finally(() => setAcceptingInvitation(false));
  }, [accessToken, pendingInvitationToken, acceptingInvitation, view]);

  useEffect(() => {
    if (!accessToken) {
      setRealtimePopups([]);
      setHomeNotifications([]);
      return;
    }

    refreshHomeNotifications(accessToken).catch(() => {});

    const wsBase = API_BASE.replace(/^http/i, "ws");
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

        if (view === "home") {
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
  }, [accessToken, view]);

  useEffect(() => {
    console.debug("[route-debug] auth-guard:enter", {
      restoringSession,
      accessTokenPresent: Boolean(accessToken),
      canAccessAdmin,
      adminAccessChecked,
      pathname: window.location.pathname,
    });

    if (restoringSession) {
      console.debug("[route-debug] auth-guard:skip restoringSession");
      return;
    }

    if (!accessToken) {
      console.debug("[route-debug] auth-guard:skip no-access-token");
      return;
    }

    const normalizedPath = normalizePathname(window.location.pathname);
    const parsed = parseSettingsRoute(normalizedPath);
    const settingsExtensions = getSettingsExtensions({ canAccessAdmin: Boolean(canAccessAdmin), adminCapabilities });
    const selectedExtension = parsed.extensionId ? settingsExtensions.find((item) => item.id === parsed.extensionId) : null;
    const validPath =
      normalizedPath === "/" ||
      normalizedPath === "/settings" ||
      normalizedPath === "/login" ||
      normalizedPath === "/register" ||
      normalizedPath === "/verify-email" ||
      normalizedPath === "/accept-invite" ||
      normalizedPath === "/settings/profile" ||
      normalizedPath === "/settings/notifications" ||
      normalizedPath === "/settings/security" ||
      normalizedPath === "/settings/groups" ||
      normalizedPath === "/settings/theme" ||
      normalizedPath === "/settings/admin/users" ||
      normalizedPath === "/settings/admin/invitations" ||
      normalizedPath === "/settings/admin/notifications" ||
      normalizedPath === "/settings/admin/roles" ||
      normalizedPath === "/admin" ||
      normalizedPath === "/invitations" ||
      normalizedPath === "/admin/users" ||
      normalizedPath === "/admin/roles" ||
      /^\/admin\/users\/[^/]+$/.test(normalizedPath) ||
        /^\/settings\/admin\/users\/[^/]+$/.test(normalizedPath) ||
        /^\/settings\/group\/[^/]+$/.test(normalizedPath) ||
        /^\/settings\/extensions\/[^/]+$/.test(normalizedPath);

    if (!validPath) {
      console.debug("[route-debug] auth-guard:redirect invalid-path", {
        pathname: normalizedPath,
        target: "/",
      });
      navigateSettings("home", null, true);
      return;
    }

    if (parsed.view === "group-detail" && !parsed.groupId) {
      console.debug("[route-debug] auth-guard:redirect invalid-group-detail", {
        pathname: normalizedPath,
        target: "/settings/groups",
      });
      navigateSettings("groups", null, true);
      return;
    }

    if (parsed.view === "extension" && !selectedExtension) {
      navigateSettings("profile", null, true);
      return;
    }

    if (parsed.view === "login" || parsed.view === "register") {
      console.debug("[route-debug] auth-guard:redirect auth-page-while-authenticated", {
        pathname: normalizedPath,
        target: "/",
      });
      navigateSettings("home", null, true);
      return;
    }

    if (parsed.view === "verify-email") {
      return;
    }

    if (parsed.view === "accept-invite") {
      return;
    }

    if (parsed.view === "admin-users" || parsed.view === "admin-invitations" || parsed.view === "admin-user-detail" || parsed.view === "admin-roles" || parsed.view === "admin-notifications") {
      if (!adminAccessChecked) {
        console.debug("[route-debug] auth-guard:wait admin-access-check", {
          pathname: normalizedPath,
        });
        return;
      }
      if (!canAccessAdmin) {
        console.debug("[route-debug] auth-guard:redirect admin-denied", {
          pathname: normalizedPath,
          target: "/",
        });
        navigateSettings("home", null, true);
        return;
      }
      if (!canAccessAdminView(parsed.view, adminCapabilities)) {
        const fallbackView = getFirstAllowedAdminView(adminCapabilities);
        if (fallbackView) {
          navigateSettings(fallbackView, null, true);
        } else {
          navigateSettings("home", null, true);
        }
        return;
      }
      console.debug("[route-debug] auth-guard:admin-route-resolved", {
        pathname: normalizedPath,
        canAccessAdmin,
      });
      return;
    }

    console.debug("[route-debug] auth-guard:allow", {
      pathname: normalizedPath,
      view: parsed.view,
    });
  }, [accessToken, canAccessAdmin, adminAccessChecked, restoringSession, adminCapabilities]);

  useEffect(() => {
    console.debug("[route-debug] public-guard:enter", {
      restoringSession,
      accessTokenPresent: Boolean(accessToken),
      pathname: window.location.pathname,
    });

    if (restoringSession) {
      console.debug("[route-debug] public-guard:skip restoringSession");
      return;
    }

    if (accessToken) {
      console.debug("[route-debug] public-guard:skip authenticated");
      return;
    }

    const normalizedPath = normalizePathname(window.location.pathname);
    const validPath =
      normalizedPath === "/" ||
      normalizedPath === "/login" ||
      normalizedPath === "/register" ||
      normalizedPath === "/verify-email" ||
      normalizedPath === "/accept-invite";

    if (!validPath) {
      console.debug("[route-debug] public-guard:redirect invalid-public-path", {
        pathname: normalizedPath,
        target: "/",
      });
      navigateSettings("home", null, true);
    }
  }, [accessToken, restoringSession]);

  if (restoringSession) {
    return (
      <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        <header className="w-full border-b border-slate-200 dark:border-slate-800">
          <div className="flex w-full items-center justify-between px-6 py-3">
            <a href="/" className="flex items-center gap-2 text-xl font-semibold">
              <span>{appIcon}</span>
              <span>{appName}</span>
            </a>
          </div>
        </header>
        <main className="mx-auto grid w-full max-w-xl gap-3 px-4 py-6">
          <p className="text-sm">Restoring session...</p>
        </main>
      </div>
    );
  }

  if (!accessToken) {
    const localEnabled = authProviders.some((provider) => provider.id === "local");
    const externalProviders = authProviders.filter((provider) => provider.id !== "local");

    return (
      <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        <header className="w-full border-b border-slate-200 dark:border-slate-800">
          <div className="flex w-full items-center justify-between px-6 py-3">
            <a href="/" className="flex items-center gap-2 text-xl font-semibold">
              <span>{appIcon}</span>
              <span>{appName}</span>
            </a>
            <AuthMenu
              isAuthenticated={false}
              registrationEnabled={registrationEnabled}
              onLogin={() => navigateSettings("login")}
              onRegister={() => navigateSettings("register")}
              onSettings={() => {}}
              onLogout={() => {}}
            />
          </div>
        </header>

        <main className="w-full px-6 py-6">
          {view === "home" ? (
            <section className="rounded-md border border-slate-200 p-5 dark:border-slate-800">
              <h2 className="mb-2 text-2xl font-semibold">Home</h2>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus vel augue ut velit pharetra suscipit.
                Suspendisse potenti. Integer id lorem vitae justo facilisis luctus non id velit.
              </p>
              <div className="mt-4">
                <Button type="button" onClick={() => navigateSettings("login")}>Login</Button>
              </div>
            </section>
          ) : null}

          {(view === "login" || view === "register" || view === "verify-email" || view === "accept-invite") ? (
            <div className="grid w-full max-w-xl gap-3">
              <h2 className="text-xl font-medium">{view === "login" ? "Login" : view === "register" ? "Register" : view === "verify-email" ? "Verify Email" : "Accept Invitation"}</h2>

              {!authMetaLoaded ? <p className="text-sm">Loading auth options...</p> : null}

              {view === "login" && localEnabled ? (
                <form onSubmit={handleLogin} className="grid gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
                  <label className="grid gap-1">
                    <span className="text-sm">Username or Email</span>
                    <Input value={usernameOrEmail} onChange={(event) => setUsernameOrEmail(event.target.value)} required />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm">Password</span>
                    <Input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </label>
                  <Button type="submit">Login</Button>
                </form>
              ) : null}

              {view === "register" && registrationEnabled ? (
                <form onSubmit={handleRegister} className="grid gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
                  <label className="grid gap-1">
                    <span className="text-sm">Username</span>
                    <Input value={registerUsername} onChange={(event) => setRegisterUsername(event.target.value)} required />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm">Email</span>
                    <Input type="email" value={registerEmail} onChange={(event) => setRegisterEmail(event.target.value)} required />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm">Password</span>
                    <Input type="password" value={registerPassword} onChange={(event) => setRegisterPassword(event.target.value)} required />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm">Display Name (optional)</span>
                    <Input value={registerDisplayName} onChange={(event) => setRegisterDisplayName(event.target.value)} />
                  </label>
                  {registerProfilePropertyCatalog.filter((property) => property.required).map((property) => {
                    const raw = registerProfileProperties[property.key];
                    const value = typeof raw === "string" ? raw : "";

                    if (property.valueType === "links") {
                      const links = getRegisterLinkItems(property.key);
                      const maxItems = property.maxItems ?? 10;
                      return (
                        <label key={property.key} className="grid gap-1">
                          <span className="text-sm">{property.label}</span>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{property.description}</p>
                          {links.map((link, index) => (
                            <div key={`${property.key}-register-link-${index}`} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                              <Input
                                value={link.label}
                                placeholder="Label"
                                onChange={(event) => {
                                  const next = [...links];
                                  next[index] = { ...next[index], label: event.target.value };
                                  setRegisterProfileProperties((current) => ({ ...current, [property.key]: next }));
                                }}
                              />
                              <Input
                                type="url"
                                value={link.url}
                                placeholder="https://..."
                                onChange={(event) => {
                                  const next = [...links];
                                  next[index] = { ...next[index], url: event.target.value };
                                  setRegisterProfileProperties((current) => ({ ...current, [property.key]: next }));
                                }}
                              />
                              <Button
                                type="button"
                                className="bg-transparent"
                                onClick={() => {
                                  const next = links.filter((_, itemIndex) => itemIndex !== index);
                                  setRegisterProfileProperties((current) => ({ ...current, [property.key]: next }));
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                          {links.length < maxItems ? (
                            <Button
                              type="button"
                              className="bg-transparent"
                              onClick={() => {
                                const next = [...links, { label: "", url: "" }];
                                setRegisterProfileProperties((current) => ({ ...current, [property.key]: next }));
                              }}
                            >
                              Add Link
                            </Button>
                          ) : null}
                        </label>
                      );
                    }

                    if (property.valueType === "boolean") {
                      const checked = raw === true;
                      return (
                        <label key={property.key} className="grid gap-1">
                          <span className="text-sm">{property.label}</span>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) =>
                                setRegisterProfileProperties((current) => ({
                                  ...current,
                                  [property.key]: event.target.checked,
                                }))
                              }
                            />
                            <span>{property.description}</span>
                          </label>
                        </label>
                      );
                    }

                    return (
                      <label key={property.key} className="grid gap-1">
                        <span className="text-sm">{property.label}</span>
                        <Input
                          type={property.valueType === "url" ? "url" : "text"}
                          value={value}
                          placeholder={property.placeholder}
                          onChange={(event) =>
                            setRegisterProfileProperties((current) => ({
                              ...current,
                              [property.key]: event.target.value,
                            }))
                          }
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {property.description}
                          {property.allowedHosts?.length ? ` Allowed hosts: ${property.allowedHosts.join(", ")}` : ""}
                        </p>
                      </label>
                    );
                  })}
                  <Button type="submit">Create Account</Button>
                </form>
              ) : null}

              {view === "login" && externalProviders.length > 0 ? (
                <div className="grid gap-2 rounded-md border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-sm font-medium">Enabled external providers</p>
                  {externalProviders.map((provider) => (
                    <Button key={provider.id} type="button" onClick={() => handleProviderStart(provider.id)}>
                      Continue with {provider.displayName}
                    </Button>
                  ))}
                </div>
              ) : null}

              {view === "login" && !localEnabled && externalProviders.length === 0 ? (
                <p className="text-sm">No authentication providers are enabled.</p>
              ) : null}

              {view === "verify-email" ? (
                <VerifyEmailPage
                  token={emailVerificationToken}
                  isAuthenticated={false}
                  onGoHome={() => navigateSettings("home")}
                  onGoLogin={() => navigateSettings("login")}
                />
              ) : null}

              {view === "accept-invite" ? (
                <AcceptInvitePage
                  token={invitationToken}
                  registrationEnabled={registrationEnabled}
                  authProviders={authProviders}
                  isAuthenticated={false}
                  acceptanceMessage={invitationAcceptanceMessage}
                  accepting={acceptingInvitation}
                  onLogin={() => navigateToAuthWithInvite("login")}
                  onRegister={() => navigateToAuthWithInvite("register")}
                  onProviderStart={handleProviderStart}
                  onGoHome={() => navigateSettings("home")}
                />
              ) : null}

              {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
            </div>
          ) : null}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <header className="w-full border-b border-slate-200 dark:border-slate-800">
        <div className="flex w-full items-center justify-between px-6 py-3">
          <a href="/" className="flex items-center gap-2 text-xl font-semibold">
            <span>{appIcon}</span>
            <span>{appName}</span>
          </a>
          <AuthMenu
            isAuthenticated={true}
            currentUserName={currentUsername}
            registrationEnabled={registrationEnabled}
            onLogin={() => {}}
            onRegister={() => {}}
            onSettings={() => navigateSettings("profile", null, window.location.pathname === "/settings/profile")}
            onLogout={handleLogout}
            extraMenuItems={adminCapabilities.invitations ? [{ label: "Invite Users", onSelect: () => setInviteDialogOpen(true) }] : []}
          />
        </div>
      </header>

      <ToastProvider>
        {realtimePopups.map((popup) => (
          <Toast
            key={popup.id}
            open={popup.open}
            duration={isActionRequiredToast(popup) ? 86_400_000 : 5000}
            onOpenChange={(open) => {
              if (!open) {
                removeToast(popup.id);
              }
            }}
            className={
              popup.severity === "error"
                ? "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200"
                : popup.severity === "warning"
                  ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
                  : popup.severity === "success"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
                    : "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200"
            }
          >
            <div className="grid gap-1">
              <ToastTitle>Notification</ToastTitle>
              <ToastDescription>{popup.message}</ToastDescription>
              <div className="mt-2 flex flex-wrap gap-2">
                {popup.requiresAcknowledgement && popup.clearanceMode === "ack" ? (
                  <Button type="button" onClick={() => onToastAcknowledge(popup.id)}>
                    Acknowledge
                  </Button>
                ) : null}
                {popup.clearanceMode === "task_gate" ? (
                  <Button type="button" onClick={() => onToastOpenTask(popup)}>
                    Open Task
                  </Button>
                ) : null}
              </div>
            </div>
            <ToastClose aria-label="Close" onClick={() => onToastManualClose(popup.id)} />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>

      {adminCapabilities.invitations ? (
        <InviteUsersDialog
          accessToken={accessToken}
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          hideTrigger
        />
      ) : null}

      {view === "home" ? (
        <main className="w-full px-6 py-6">
          {homeNotifications.length > 0 ? (
            <section className="mb-4 grid gap-2">
              {homeNotifications.map((notification) => (
                <div key={notification.id} className="rounded-md border border-slate-200 px-4 py-3 text-sm dark:border-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{notification.message}</p>
                    <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{notification.clearanceMode}</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {notification.clearanceMode === "ack" && !notification.acknowledgedAt ? (
                      <Button type="button" onClick={() => onHomeAcknowledge(notification.id)}>
                        Acknowledge
                      </Button>
                    ) : null}
                    {notification.clearanceMode === "task_gate" ? (
                      <Button type="button" onClick={() => onOpenTask(notification)}>
                        Open Task
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </section>
          ) : null}
          <section className="rounded-md border border-slate-200 p-6 dark:border-slate-800">
            <h2 className="mb-2 text-xl font-semibold">Welcome, {currentUsername}</h2>
            <h2 className="mb-3 text-2xl font-semibold">Home</h2>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc sit amet ante nec nulla faucibus tempus.
              Fusce eget lacus at sapien faucibus malesuada et vitae justo.
            </p>
            <div className="mt-4">
              <Button type="button" onClick={() => navigateSettings("profile")}>
                Go to Settings
              </Button>
            </div>
          </section>
        </main>
      ) : (
        <main className="w-full px-6 py-6">
          {(() => {
            const settingsExtensions = getSettingsExtensions({ canAccessAdmin: Boolean(canAccessAdmin), adminCapabilities });
            const settingsExtensionItems = settingsExtensions.filter((item) => (item.section ?? "settings") === "settings");
            const adminExtensionItems = settingsExtensions.filter((item) => item.section === "administration");
            const activeExtension = selectedExtensionId ? settingsExtensions.find((item) => item.id === selectedExtensionId) : null;

            return (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
              <nav className="grid gap-3">
                <div className="grid gap-2">
                  <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Settings</p>
                  <Button
                    type="button"
                    className={view === "profile" ? "bg-slate-100 dark:bg-slate-800" : ""}
                    onClick={() => navigateSettings("profile")}
                  >
                    Profile
                  </Button>
                  <Button
                    type="button"
                    className={view === "notifications" ? "bg-slate-100 dark:bg-slate-800" : ""}
                    onClick={() => navigateSettings("notifications")}
                  >
                    Notifications
                  </Button>
                  <Button
                    type="button"
                    className={view === "security" ? "bg-slate-100 dark:bg-slate-800" : ""}
                    onClick={() => navigateSettings("security")}
                  >
                    Security
                  </Button>
                  <Button
                    type="button"
                    className={view === "groups" || view === "group-detail" ? "bg-slate-100 dark:bg-slate-800" : ""}
                    onClick={() => navigateSettings("groups")}
                  >
                    Groups
                  </Button>
                  <Button
                    type="button"
                    className={view === "theme" ? "bg-slate-100 dark:bg-slate-800" : ""}
                    onClick={() => navigateSettings("theme")}
                  >
                    Theme
                  </Button>
                  {settingsExtensionItems.map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      className={view === "extension" && selectedExtensionId === item.id ? "bg-slate-100 dark:bg-slate-800" : ""}
                      onClick={() => navigateExtensionSettings(item.id)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>

                {canAccessAdmin ? (
                  <div className="grid gap-2">
                    <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Administration</p>
                    {adminCapabilities.users ? (
                      <Button
                        type="button"
                        className={view === "admin-users" || view === "admin-user-detail" ? "bg-slate-100 dark:bg-slate-800" : ""}
                        onClick={() => navigateSettings("admin-users")}
                      >
                        Users
                      </Button>
                    ) : null}
                    {adminCapabilities.invitations ? (
                      <Button
                        type="button"
                        className={view === "admin-invitations" ? "bg-slate-100 dark:bg-slate-800" : ""}
                        onClick={() => navigateSettings("admin-invitations")}
                      >
                        Invitations
                      </Button>
                    ) : null}
                    {adminCapabilities.roles ? (
                      <Button
                        type="button"
                        className={view === "admin-notifications" ? "bg-slate-100 dark:bg-slate-800" : ""}
                        onClick={() => navigateSettings("admin-notifications")}
                      >
                        Notifications
                      </Button>
                    ) : null}
                    {adminCapabilities.roles ? (
                      <Button
                        type="button"
                        className={view === "admin-roles" ? "bg-slate-100 dark:bg-slate-800" : ""}
                        onClick={() => navigateSettings("admin-roles")}
                      >
                        Roles
                      </Button>
                    ) : null}
                    {adminExtensionItems.map((item) => (
                      <Button
                        key={item.id}
                        type="button"
                        className={view === "extension" && selectedExtensionId === item.id ? "bg-slate-100 dark:bg-slate-800" : ""}
                        onClick={() => navigateExtensionSettings(item.id)}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </nav>
            </aside>

            <section>
              {view === "profile" ? <ProfilePage accessToken={accessToken} /> : null}
              {view === "notifications" ? <NotificationsPage accessToken={accessToken} refreshSignal={notificationRefreshSignal} /> : null}
              {view === "security" ? <SecurityPage /> : null}
              {view === "groups" ? (
                <GroupsPage
                  accessToken={accessToken}
                  canViewAllGroups={adminCapabilities.groups}
                  onOpenGroup={(groupId) => {
                    navigateSettings("group-detail", groupId);
                  }}
                />
              ) : null}
              {view === "group-detail" && selectedGroupId ? (
                <GroupDetailPage
                  accessToken={accessToken}
                  groupId={selectedGroupId}
                  canAssignRoles={adminCapabilities.groups}
                  onBack={() => navigateSettings("groups")}
                />
              ) : null}
              {view === "theme" ? <ThemePage accessToken={accessToken} theme={theme} onThemeChange={setTheme} /> : null}
              {view === "verify-email" ? (
                <VerifyEmailPage
                  token={emailVerificationToken}
                  isAuthenticated={true}
                  onGoHome={() => navigateSettings("home")}
                  onGoLogin={() => navigateSettings("login")}
                />
              ) : null}
              {view === "accept-invite" ? (
                <AcceptInvitePage
                  token={invitationToken}
                  registrationEnabled={registrationEnabled}
                  authProviders={authProviders}
                  isAuthenticated={true}
                  acceptanceMessage={invitationAcceptanceMessage}
                  accepting={acceptingInvitation}
                  onLogin={() => navigateSettings("login")}
                  onRegister={() => navigateSettings("register")}
                  onProviderStart={handleProviderStart}
                  onGoHome={() => navigateSettings("home")}
                />
              ) : null}
              {view === "admin-users" ? (
                <AdminUsersPage
                  accessToken={accessToken}
                  onOpenUser={(userId) => navigateSettings("admin-user-detail", null, false, userId)}
                  onOpenInvitations={() => navigateSettings("admin-invitations")}
                />
              ) : null}
              {view === "admin-invitations" ? <AdminInvitationsPage accessToken={accessToken} /> : null}
              {view === "admin-notifications" ? <AdminNotificationsPage accessToken={accessToken} /> : null}
              {view === "admin-user-detail" && selectedAdminUserId ? (
                <AdminUserDetailPage
                  accessToken={accessToken}
                  userId={selectedAdminUserId}
                  onBack={() => navigateSettings("admin-users")}
                />
              ) : null}
              {view === "admin-roles" ? <AdminRolesPage accessToken={accessToken} /> : null}
              {view === "extension" && activeExtension ? activeExtension.render({ accessToken }) : null}
            </section>
          </div>
            );
          })()}
        </main>
      )}
    </div>
  );
}
