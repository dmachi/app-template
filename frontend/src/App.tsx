import { FormEvent, useEffect, useState } from "react";

import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { GroupDetailPage } from "./pages/group-detail-page";
import { GroupsPage } from "./pages/groups-page";
import { ProfilePage } from "./pages/profile-page";
import { login, logout, refreshSession } from "./lib/api";

type View = "profile" | "groups" | "group-detail";
const REFRESH_TOKEN_STORAGE_KEY = "bst.refreshToken";

export function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [restoringSession, setRestoringSession] = useState(true);
  const [view, setView] = useState<View>("profile");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

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
      setPassword("");
      setView("profile");
      setSelectedGroupId(null);
    }
  }

  if (restoringSession) {
    return (
      <main className="mx-auto grid w-full max-w-xl gap-3 px-4 py-6">
        <h1 className="text-2xl font-semibold">Basic System Template</h1>
        <p className="text-sm">Restoring session...</p>
      </main>
    );
  }

  if (!accessToken) {
    return (
      <main className="mx-auto grid w-full max-w-xl gap-3 px-4 py-6">
        <h1 className="text-2xl font-semibold">Basic System Template</h1>
        <h2 className="text-xl font-medium">Login</h2>
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
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6">
      <header className="flex items-center gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800">
        <h1 className="mr-auto text-xl font-semibold">Basic System Template</h1>
        <Button onClick={() => setView("profile")} type="button">
          Profile
        </Button>
        <Button onClick={() => setView("groups")} type="button">
          My Groups
        </Button>
        <Button
          onClick={handleLogout}
          type="button"
        >
          Logout
        </Button>
      </header>
      {view === "profile" ? <ProfilePage accessToken={accessToken} /> : null}
      {view === "groups" ? (
        <GroupsPage
          accessToken={accessToken}
          onOpenGroup={(groupId) => {
            setSelectedGroupId(groupId);
            setView("group-detail");
          }}
        />
      ) : null}
      {view === "group-detail" && selectedGroupId ? (
        <GroupDetailPage
          accessToken={accessToken}
          groupId={selectedGroupId}
          onBack={() => setView("groups")}
        />
      ) : null}
    </main>
  );
}
