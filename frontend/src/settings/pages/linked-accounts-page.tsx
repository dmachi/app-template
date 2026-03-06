import { useEffect, useMemo, useState } from "react";

import { useAppRouteRenderContext } from "../../app/app-route-render-context";
import { Button } from "../../components/ui/button";
import { showClientToast } from "../../lib/client-toast";
import {
  completeMyLinkedExternalAccount,
  listExternalAccountProviders,
  listMyLinkedExternalAccounts,
  startMyLinkedExternalAccount,
  type ExternalOAuthProviderItem,
  type LinkedExternalAccountItem,
} from "../../lib/api";

type LinkedAccountsPageProps = {
  accessToken: string;
};

type PendingStateMap = Record<string, string>;

const PENDING_STATE_STORAGE_KEY = "linked_external_account_state_map";

function loadPendingStateMap(): PendingStateMap {
  try {
    const raw = window.sessionStorage.getItem(PENDING_STATE_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed as PendingStateMap : {};
  } catch {
    return {};
  }
}

function savePendingStateMap(value: PendingStateMap) {
  window.sessionStorage.setItem(PENDING_STATE_STORAGE_KEY, JSON.stringify(value));
}

export function LinkedAccountsPage({ accessToken }: LinkedAccountsPageProps) {
  const [providers, setProviders] = useState<ExternalOAuthProviderItem[]>([]);
  const [items, setItems] = useState<LinkedExternalAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingProvider, setStartingProvider] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [providerPayload, linkedPayload] = await Promise.all([
        listExternalAccountProviders(accessToken),
        listMyLinkedExternalAccounts(accessToken),
      ]);
      setProviders(providerPayload.items);
      setItems(linkedPayload.items);
    } catch (error) {
      showClientToast({ title: "Linked Accounts", message: error instanceof Error ? error.message : "Unable to load linked accounts", severity: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch(() => {});
  }, [accessToken]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) {
      return;
    }

    const pending = loadPendingStateMap();
    const provider = pending[state];
    if (!provider) {
      showClientToast({ title: "Linked Accounts", message: "Unable to match external account state for completion", severity: "error" });
      return;
    }

    completeMyLinkedExternalAccount(accessToken, provider, { code, state })
      .then(async () => {
        showClientToast({ title: "Linked Accounts", message: "External account linked", severity: "success" });
        const updatedPending = loadPendingStateMap();
        delete updatedPending[state];
        savePendingStateMap(updatedPending);

        params.delete("code");
        params.delete("state");
        const nextSearch = params.toString();
        const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
        window.history.replaceState({}, "", nextUrl);

        await loadData();
      })
      .catch((error) => {
        showClientToast({ title: "Linked Accounts", message: error instanceof Error ? error.message : "Unable to complete linked account", severity: "error" });
      });
  }, [accessToken]);

  function isProviderLinked(providerId: string): boolean {
    return items.some((item) => item.provider === providerId);
  }

  async function startLink(provider: ExternalOAuthProviderItem) {
    setStartingProvider(provider.provider);
    try {
      const redirectUri = `${window.location.origin}/settings/linked-accounts`;
      const payload = await startMyLinkedExternalAccount(accessToken, provider.provider, {
        scopes: [],
        redirectUri,
      });
      const pending = loadPendingStateMap();
      pending[payload.state] = provider.provider;
      savePendingStateMap(pending);
      window.location.assign(payload.authorizationUrl);
    } catch (error) {
      showClientToast({ title: "Linked Accounts", message: error instanceof Error ? error.message : "Unable to start linking flow", severity: "error" });
      setStartingProvider(null);
    }
  }

  const linkedProviders = useMemo(() => new Set(items.map((item) => item.provider)), [items]);
  const sortedProviders = useMemo(
    () => [...providers].sort((left, right) => Number(isProviderLinked(right.provider)) - Number(isProviderLinked(left.provider))),
    [providers, items],
  );

  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Linked Accounts</h2>
        <Button type="button" onClick={() => loadData()}>Refresh</Button>
      </div>

      <div className="grid gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <h3 className="text-base font-medium">Enabled Account Types</h3>
        {loading ? <p className="text-sm">Loading linked accounts...</p> : null}
        {!loading && sortedProviders.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No external providers are enabled.</p> : null}
        <div className="grid gap-2">
          {sortedProviders.map((provider) => {
            const linked = linkedProviders.has(provider.provider);
            const linkedItem = items.find((item) => item.provider === provider.provider) || null;
            return (
            <div key={provider.provider} className="rounded border border-slate-200 p-3 text-sm dark:border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{provider.displayName}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Status: {linked ? "Linked" : "Not linked"}</p>
                  {linkedItem ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Scopes: {linkedItem.scopes.join(" ") || "none"}</p> : null}
                </div>
                {!linked ? (
                  <Button type="button" onClick={() => startLink(provider)} disabled={startingProvider === provider.provider}>
                    {startingProvider === provider.provider ? "Starting..." : "Link"}
                  </Button>
                ) : null}
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function LinkedAccountsRoutePage() {
  const routeContext = useAppRouteRenderContext();
  if (!routeContext.isAuthenticated) {
    return null;
  }
  return <LinkedAccountsPage accessToken={routeContext.settingsProps.accessToken} />;
}
