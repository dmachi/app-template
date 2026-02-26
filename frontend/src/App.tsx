import { FormEvent, useEffect, useState } from "react";

import { AuthMenu } from "./components/shared/auth-menu";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { AdminGroupsPage } from "./pages/admin-groups-page";
import { AdminInvitationsPage } from "./pages/admin-invitations-page";
import { AdminRolesPage } from "./pages/admin-roles-page";
import { AdminUserDetailPage } from "./pages/admin-user-detail-page";
import { AdminUsersPage } from "./pages/admin-users-page";
import { AcceptInvitePage } from "./pages/accept-invite-page";
import { GroupDetailPage } from "./pages/group-detail-page";
import { GroupsPage } from "./pages/groups-page";
import { ProfilePage } from "./pages/profile-page";
import { SecurityPage } from "./pages/security-page";
import { ThemePage } from "./pages/theme-page";
import { VerifyEmailPage } from "./pages/verify-email-page";
import {
  acceptInvitation,
  getAdminCapabilities,
  getAuthProviders,
  getMyProfile,
  login,
  logout,
  refreshSession,
  register,
  startRedirectProvider,
  type AuthProviderMeta,
} from "./lib/api";

type View =
  | "home"
  | "login"
  | "register"
  | "accept-invite"
  | "verify-email"
  | "profile"
  | "security"
  | "groups"
  | "group-detail"
  | "theme"
  | "admin-invitations"
  | "admin-users"
  | "admin-user-detail"
  | "admin-roles"
  | "admin-groups";
type ThemeOption = "light" | "dark" | "system";
const REFRESH_TOKEN_STORAGE_KEY = "bst.refreshToken";
const INVITE_TOKEN_STORAGE_KEY = "bst.pendingInviteToken";

function normalizePathname(pathname: string): string {
  if (pathname !== "/" && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function parseSettingsRoute(pathname: string): { view: View; groupId: string | null; adminUserId: string | null } {
  pathname = normalizePathname(pathname);

  if (pathname === "/") {
    return { view: "home", groupId: null, adminUserId: null };
  }
  if (pathname === "/settings") {
    return { view: "profile", groupId: null, adminUserId: null };
  }
  if (pathname === "/login") {
    return { view: "login", groupId: null, adminUserId: null };
  }
  if (pathname === "/register") {
    return { view: "register", groupId: null, adminUserId: null };
  }
  if (pathname === "/verify-email") {
    return { view: "verify-email", groupId: null, adminUserId: null };
  }
  if (pathname === "/accept-invite") {
    return { view: "accept-invite", groupId: null, adminUserId: null };
  }
  if (pathname === "/settings/profile") {
    return { view: "profile", groupId: null, adminUserId: null };
  }
  if (pathname === "/settings/security") {
    return { view: "security", groupId: null, adminUserId: null };
  }
  if (pathname === "/settings/groups") {
    return { view: "groups", groupId: null, adminUserId: null };
  }
  if (pathname === "/settings/theme") {
    return { view: "theme", groupId: null, adminUserId: null };
  }
  if (pathname === "/admin") {
    return { view: "admin-users", groupId: null, adminUserId: null };
  }
  if (pathname === "/invitations") {
    return { view: "admin-invitations", groupId: null, adminUserId: null };
  }
  if (pathname === "/admin/users") {
    return { view: "admin-users", groupId: null, adminUserId: null };
  }
  if (pathname === "/admin/roles") {
    return { view: "admin-roles", groupId: null, adminUserId: null };
  }
  if (pathname === "/admin/groups") {
    return { view: "admin-groups", groupId: null, adminUserId: null };
  }
  const adminUserMatch = pathname.match(/^\/admin\/users\/([^/]+)$/);
  if (adminUserMatch) {
    return { view: "admin-user-detail", groupId: null, adminUserId: adminUserMatch[1] };
  }
  const groupMatch = pathname.match(/^\/settings\/group\/([^/]+)$/);
  if (groupMatch) {
    return { view: "group-detail", groupId: groupMatch[1], adminUserId: null };
  }
  return { view: "home", groupId: null, adminUserId: null };
}

function buildSettingsPath(view: View, groupId: string | null, adminUserId: string | null): string {
  if (view === "home") {
    return "/";
  }
  if (view === "profile") {
    return "/settings/profile";
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
    return "/admin/users";
  }
  if (view === "admin-invitations") {
    return "/invitations";
  }
  if (view === "admin-user-detail" && adminUserId) {
    return `/admin/users/${adminUserId}`;
  }
  if (view === "admin-roles") {
    return "/admin/roles";
  }
  if (view === "admin-groups") {
    return "/admin/groups";
  }
  if (view === "group-detail" && groupId) {
    return `/settings/group/${groupId}`;
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
  const [error, setError] = useState<string | null>(null);

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
    if (capabilities.groups) {
      return "admin-groups";
    }
    if (capabilities.roles) {
      return "admin-roles";
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
    if (nextView === "admin-groups") {
      return capabilities.groups;
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
        console.debug("[route-debug] canonical redirect", { from: "/admin", to: "/admin/users" });
        window.history.replaceState({}, "", "/admin/users");
      }
      const { view: nextView, groupId, adminUserId } = parseSettingsRoute(window.location.pathname);
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const inviteToken = params.get("inviteToken");
      const storedPendingInviteToken = window.localStorage.getItem(INVITE_TOKEN_STORAGE_KEY);
      console.debug("[route-debug] syncFromLocation:parsed", {
        pathname: window.location.pathname,
        nextView,
        groupId,
        adminUserId,
        tokenPresent: Boolean(token),
        inviteTokenPresent: Boolean(inviteToken),
        storedPendingInviteTokenPresent: Boolean(storedPendingInviteToken),
      });
      setView(nextView);
      setSelectedGroupId(groupId);
      setSelectedAdminUserId(adminUserId);
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
      })
      .catch((metaError) => {
        setError(metaError instanceof Error ? metaError.message : "Unable to load auth options");
      })
      .finally(() => setAuthMetaLoaded(true));
  }, []);

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
      const response = await register(registerUsername, registerEmail, registerPassword, registerDisplayName || undefined);
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
      window.localStorage.removeItem(INVITE_TOKEN_STORAGE_KEY);
      window.history.replaceState({}, "", "/");
    }
  }

  function navigateToAuthWithInvite(nextView: "login" | "register") {
    const path = buildSettingsPath(nextView, null, null);
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
    const path = buildSettingsPath(nextView, groupId, adminUserId);
    if (replace) {
      window.history.replaceState({}, "", path);
    } else {
      window.history.pushState({}, "", path);
    }
    setView(nextView);
    setSelectedGroupId(groupId);
    setSelectedAdminUserId(adminUserId);
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
    const validPath =
      normalizedPath === "/" ||
      normalizedPath === "/settings" ||
      normalizedPath === "/login" ||
      normalizedPath === "/register" ||
      normalizedPath === "/verify-email" ||
      normalizedPath === "/accept-invite" ||
      normalizedPath === "/settings/profile" ||
      normalizedPath === "/settings/security" ||
      normalizedPath === "/settings/groups" ||
      normalizedPath === "/settings/theme" ||
      normalizedPath === "/admin" ||
      normalizedPath === "/invitations" ||
      normalizedPath === "/admin/users" ||
      normalizedPath === "/admin/roles" ||
      normalizedPath === "/admin/groups" ||
      /^\/admin\/users\/[^/]+$/.test(normalizedPath) ||
      /^\/settings\/group\/[^/]+$/.test(normalizedPath);

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

    if (parsed.view === "admin-users" || parsed.view === "admin-invitations" || parsed.view === "admin-user-detail" || parsed.view === "admin-roles" || parsed.view === "admin-groups") {
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
            extraMenuItems={canAccessAdmin ? [{ label: "Admin", onSelect: () => navigateSettings(getFirstAllowedAdminView(adminCapabilities) || "home") }] : []}
          />
        </div>
      </header>

      {view === "home" ? (
        <main className="w-full px-6 py-6">
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
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
              {view === "profile" || view === "security" || view === "groups" || view === "group-detail" || view === "theme" ? (
                <nav className="grid gap-2">
                  <Button
                    type="button"
                    className={view === "profile" ? "bg-slate-100 dark:bg-slate-800" : ""}
                    onClick={() => navigateSettings("profile")}
                  >
                    Profile
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
                    Groups - Group Management
                  </Button>
                  <Button
                    type="button"
                    className={view === "theme" ? "bg-slate-100 dark:bg-slate-800" : ""}
                    onClick={() => navigateSettings("theme")}
                  >
                    Theme
                  </Button>
                </nav>
              ) : null}

              {view === "admin-users" || view === "admin-invitations" || view === "admin-user-detail" || view === "admin-roles" || view === "admin-groups" ? (
                <nav className="grid gap-2">
                  <Button
                    type="button"
                    className={view === "admin-users" || view === "admin-user-detail" ? "bg-slate-100 dark:bg-slate-800" : ""}
                    onClick={() => navigateSettings("admin-users")}
                    disabled={!adminCapabilities.users}
                  >
                    Users
                  </Button>
                  <Button
                    type="button"
                    className={view === "admin-invitations" ? "bg-slate-100 dark:bg-slate-800" : ""}
                    onClick={() => navigateSettings("admin-invitations")}
                    disabled={!adminCapabilities.invitations}
                  >
                    Invitations
                  </Button>
                  <Button
                    type="button"
                    className={view === "admin-roles" ? "bg-slate-100 dark:bg-slate-800" : ""}
                    onClick={() => navigateSettings("admin-roles")}
                    disabled={!adminCapabilities.roles}
                  >
                    Roles
                  </Button>
                  <Button
                    type="button"
                    className={view === "admin-groups" ? "bg-slate-100 dark:bg-slate-800" : ""}
                    onClick={() => navigateSettings("admin-groups")}
                    disabled={!adminCapabilities.groups}
                  >
                    All Groups
                  </Button>
                </nav>
              ) : null}
            </aside>

            <section>
              {view === "profile" ? <ProfilePage accessToken={accessToken} /> : null}
              {view === "security" ? <SecurityPage /> : null}
              {view === "groups" ? (
                <GroupsPage
                  accessToken={accessToken}
                  onOpenGroup={(groupId) => {
                    navigateSettings("group-detail", groupId);
                  }}
                />
              ) : null}
              {view === "group-detail" && selectedGroupId ? (
                <GroupDetailPage
                  accessToken={accessToken}
                  groupId={selectedGroupId}
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
              {view === "admin-user-detail" && selectedAdminUserId ? (
                <AdminUserDetailPage
                  accessToken={accessToken}
                  userId={selectedAdminUserId}
                  onBack={() => navigateSettings("admin-users")}
                />
              ) : null}
              {view === "admin-roles" ? <AdminRolesPage accessToken={accessToken} /> : null}
              {view === "admin-groups" ? <AdminGroupsPage accessToken={accessToken} /> : null}
            </section>
          </div>
        </main>
      )}
    </div>
  );
}
