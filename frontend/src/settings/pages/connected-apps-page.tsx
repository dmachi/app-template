import { useEffect, useState } from "react";

import { useAppRouteRenderContext } from "../../app/app-route-render-context";
import { Button } from "../../components/ui/button";
import { showClientToast } from "../../lib/client-toast";
import { listMyConnectedApps, revokeMyConnectedApp, type ConnectedAppItem } from "../../lib/api";

type ConnectedAppsPageProps = {
  accessToken: string;
};

export function ConnectedAppsPage({ accessToken }: ConnectedAppsPageProps) {
  const [apps, setApps] = useState<ConnectedAppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingClientId, setRevokingClientId] = useState<string | null>(null);

  async function loadConnectedApps() {
    setLoading(true);
    try {
      const payload = await listMyConnectedApps(accessToken);
      setApps(payload.items);
    } catch (error) {
      showClientToast({ title: "Connected Apps", message: error instanceof Error ? error.message : "Unable to load connected apps", severity: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConnectedApps().catch(() => {});
  }, [accessToken]);

  async function onRevoke(app: ConnectedAppItem) {
    const confirmed = window.confirm(`Revoke access for ${app.name}?`);
    if (!confirmed) {
      return;
    }

    setRevokingClientId(app.clientId);
    try {
      const result = await revokeMyConnectedApp(accessToken, app.clientId);
      if (result.revoked) {
        showClientToast({ title: "Connected Apps", message: "Access revoked.", severity: "success" });
      } else {
        showClientToast({ title: "Connected Apps", message: "App was already disconnected.", severity: "info" });
      }
      await loadConnectedApps();
    } catch (error) {
      showClientToast({ title: "Connected Apps", message: error instanceof Error ? error.message : "Unable to revoke app", severity: "error" });
    } finally {
      setRevokingClientId(null);
    }
  }

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Connected Apps</h2>
        <Button type="button" onClick={() => loadConnectedApps()}>
          Refresh
        </Button>
      </div>

      {loading ? <p className="text-sm">Loading connected apps...</p> : null}
      {!loading && apps.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No connected apps.</p> : null}

      <div className="grid gap-2">
        {apps.map((app) => (
          <div key={app.clientId} className="rounded border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{app.name}</p>
              <Button
                type="button"
                onClick={() => onRevoke(app)}
                disabled={revokingClientId === app.clientId}
              >
                {revokingClientId === app.clientId ? "Revoking..." : "Revoke"}
              </Button>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Client ID: {app.clientId}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Scopes: {app.scopes.join(" ") || "none"}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Connected: {new Date(app.connectedAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ConnectedAppsRoutePage() {
  const routeContext = useAppRouteRenderContext();
  if (!routeContext.isAuthenticated) {
    return null;
  }
  return <ConnectedAppsPage accessToken={routeContext.settingsProps.accessToken} />;
}
