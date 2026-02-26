import { FormEvent, useEffect, useState } from "react";

import { AuthMenu } from "./components/shared/auth-menu";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { GroupDetailPage } from "./pages/group-detail-page";
import { GroupsPage } from "./pages/groups-page";
import { ProfilePage } from "./pages/profile-page";
import { SecurityPage } from "./pages/security-page";
import { ThemePage } from "./pages/theme-page";
import { getAuthProviders, getMyProfile, login, logout, refreshSession, register, startRedirectProvider, type AuthProviderMeta } from "./lib/api";

type View = "home" | "login" | "register" | "profile" | "security" | "groups" | "group-detail" | "theme";
type ThemeOption = "light" | "dark" | "system";
const REFRESH_TOKEN_STORAGE_KEY = "bst.refreshToken";

function parseSettingsRoute(pathname: string): { view: View; groupId: string | null } {
  if (pathname === "/") {
    return { view: "home", groupId: null };
  }
  if (pathname === "/settings") {
    return { view: "profile", groupId: null };
  }
  if (pathname === "/login") {
    return { view: "login", groupId: null };
  }
  if (pathname === "/register") {
    return { view: "register", groupId: null };
  }
  if (pathname === "/settings/profile") {
    return { view: "profile", groupId: null };
  }
  if (pathname === "/settings/security") {
    return { view: "security", groupId: null };
  }
  if (pathname === "/settings/groups") {
    return { view: "groups", groupId: null };
  }
  if (pathname === "/settings/theme") {
    return { view: "theme", groupId: null };
  }
  const groupMatch = pathname.match(/^\/settings\/group\/([^/]+)$/);
  if (groupMatch) {
    return { view: "group-detail", groupId: groupMatch[1] };
  }
  return { view: "home", groupId: null };
}

function buildSettingsPath(view: View, groupId: string | null): string {
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
  if (view === "groups") {
    return "/settings/groups";
  }
  if (view === "security") {
    return "/settings/security";
  }
  if (view === "theme") {
    return "/settings/theme";
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
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
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
      if (window.location.pathname === "/settings") {
        window.history.replaceState({}, "", "/settings/profile");
      }
      const { view: nextView, groupId } = parseSettingsRoute(window.location.pathname);
      setView(nextView);
      setSelectedGroupId(groupId);
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
      return;
    }

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
      await register(registerUsername, registerEmail, registerPassword, registerDisplayName || undefined);
      navigateSettings("login");
      setUsernameOrEmail(registerUsername || registerEmail);
      setPassword("");
      setRegisterPassword("");
      setError("Registration successful. Please login.");
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : "Unable to register");
    }
  }

  async function handleProviderStart(providerId: string) {
    setError(null);
    try {
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
      window.history.replaceState({}, "", "/");
    }
  }

  function navigateSettings(nextView: View, groupId: string | null = null, replace = false) {
    const path = buildSettingsPath(nextView, groupId);
    if (replace) {
      window.history.replaceState({}, "", path);
    } else {
      window.history.pushState({}, "", path);
    }
    setView(nextView);
    setSelectedGroupId(groupId);
  }

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const parsed = parseSettingsRoute(window.location.pathname);
    const validPath =
      window.location.pathname === "/" ||
      window.location.pathname === "/settings" ||
      window.location.pathname === "/login" ||
      window.location.pathname === "/register" ||
      window.location.pathname === "/settings/profile" ||
      window.location.pathname === "/settings/security" ||
      window.location.pathname === "/settings/groups" ||
      window.location.pathname === "/settings/theme" ||
      /^\/settings\/group\/[^/]+$/.test(window.location.pathname);

    if (!validPath) {
      navigateSettings("home", null, true);
      return;
    }

    if (parsed.view === "group-detail" && !parsed.groupId) {
      navigateSettings("groups", null, true);
      return;
    }

    if (parsed.view === "login" || parsed.view === "register") {
      navigateSettings("home", null, true);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) {
      return;
    }

    const validPath =
      window.location.pathname === "/" ||
      window.location.pathname === "/login" ||
      window.location.pathname === "/register";

    if (!validPath) {
      navigateSettings("home", null, true);
    }
  }, [accessToken]);

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

          {(view === "login" || view === "register") ? (
            <div className="grid w-full max-w-xl gap-3">
              <h2 className="text-xl font-medium">{view === "login" ? "Login" : "Register"}</h2>

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
            </section>
          </div>
        </main>
      )}
    </div>
  );
}
