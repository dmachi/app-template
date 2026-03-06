import { FormEvent, MouseEvent, useEffect, useState } from "react";

import { useAppRouteRenderContext } from "../../app/app-route-render-context";
import { FormField } from "../../components/form-field";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { showClientToast } from "../../lib/client-toast";
import {
  createMyAccessToken,
  listMyAccessTokenScopes,
  listMyAccessTokens,
  revokeMyAccessToken,
  type AccessTokenItem,
  type AuthScopeItem,
} from "../../lib/api";

type AccessTokensPageProps = {
  accessToken: string;
};

export function AccessTokensPage({ accessToken }: AccessTokensPageProps) {
  const [items, setItems] = useState<AccessTokenItem[]>([]);
  const [scopeItems, setScopeItems] = useState<AuthScopeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [newTokenValue, setNewTokenValue] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [tokensPayload, scopesPayload] = await Promise.all([
        listMyAccessTokens(accessToken),
        listMyAccessTokenScopes(accessToken),
      ]);
      setItems(tokensPayload.items);
      setScopeItems(scopesPayload.items);
      if (selectedScopes.length === 0) {
        setSelectedScopes(scopesPayload.items.map((item) => item.name));
      }
    } catch (error) {
      showClientToast({ title: "Access Tokens", message: error instanceof Error ? error.message : "Unable to load access tokens", severity: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch(() => {});
  }, [accessToken]);

  useEffect(() => {
    if (!newTokenValue || !isCreateDialogOpen) {
      return;
    }

    navigator.clipboard.writeText(newTokenValue)
      .then(() => {
        showClientToast({ title: "Access Tokens", message: "Copied", severity: "success" });
      })
      .catch(() => {
        showClientToast({ title: "Access Tokens", message: "Unable to copy token", severity: "error" });
      });
  }, [newTokenValue, isCreateDialogOpen]);

  function handleCreateDialogOpenChange(open: boolean) {
    setIsCreateDialogOpen(open);
    if (!open) {
      setNewTokenValue(null);
      setName("");
      setExpiresAt("");
    }
  }

  function toggleScope(scope: string) {
    setSelectedScopes((previous) => {
      if (previous.includes(scope)) {
        return previous.filter((item) => item !== scope);
      }
      return [...previous, scope];
    });
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      showClientToast({ title: "Access Tokens", message: "Token name is required", severity: "warning" });
      return;
    }

    setCreating(true);
    try {
      const payload = await createMyAccessToken(accessToken, {
        name: name.trim(),
        scopes: selectedScopes,
        ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
      });
      setNewTokenValue(payload.token);
      showClientToast({ title: "Access Tokens", message: "Token created", severity: "success" });
      await loadData();
    } catch (error) {
      showClientToast({ title: "Access Tokens", message: error instanceof Error ? error.message : "Unable to create token", severity: "error" });
    } finally {
      setCreating(false);
    }
  }

  async function onRevoke(item: AccessTokenItem) {
    const confirmed = window.confirm(`Revoke access token ${item.name}?`);
    if (!confirmed) {
      return;
    }

    setRevokingId(item.id);
    try {
      const result = await revokeMyAccessToken(accessToken, item.id);
      if (result.revoked) {
        showClientToast({ title: "Access Tokens", message: "Token revoked.", severity: "success" });
      }
      await loadData();
    } catch (error) {
      showClientToast({ title: "Access Tokens", message: error instanceof Error ? error.message : "Unable to revoke token", severity: "error" });
    } finally {
      setRevokingId(null);
    }
  }

  async function onSelectNewToken(event: MouseEvent<HTMLInputElement>) {
    const tokenValue = newTokenValue;
    if (!tokenValue) {
      return;
    }

    event.currentTarget.select();

    try {
      await navigator.clipboard.writeText(tokenValue);
      showClientToast({ title: "Access Tokens", message: "Copied", severity: "success" });
    } catch {
      showClientToast({ title: "Access Tokens", message: "Unable to copy token", severity: "error" });
    }
  }

  return (
    <section className="grid gap-4">
      <h2 className="text-lg font-medium">Access Tokens</h2>

      <div className="grid gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-medium">Create Token</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Create a personal access token in a popup dialog.</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogOpenChange}>
            <DialogTrigger asChild>
              <Button type="button">Create Access Token</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader className="mb-2">
                <DialogTitle>Create Access Token</DialogTitle>
                <DialogDescription>Provide a token name, optional expiration, and scopes.</DialogDescription>
              </DialogHeader>

              {newTokenValue ? (
                <div className="grid gap-3">
                  <p className="text-sm">Token created successfully. Copy it now; it cannot be viewed again after closing this dialog.</p>
                  <Input value={newTokenValue} readOnly onClick={onSelectNewToken} />
                  <div className="flex justify-end gap-2">
                    <DialogClose asChild>
                      <Button type="button">Close</Button>
                    </DialogClose>
                  </div>
                </div>
              ) : (
                <form onSubmit={onCreate} className="grid gap-3">
                  <FormField label="Name">
                    <Input value={name} onChange={(event) => setName(event.target.value)} required />
                  </FormField>
                  <FormField label="Expiration (optional)">
                    <Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
                  </FormField>
                  <div className="grid gap-2">
                    <p className="text-sm font-medium">Scopes</p>
                    <div className="grid max-h-48 gap-2 overflow-auto rounded-md border border-slate-200 p-2 dark:border-slate-800">
                      {scopeItems.map((scope) => (
                        <label key={scope.name} className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedScopes.includes(scope.name)}
                            onChange={() => toggleScope(scope.name)}
                          />
                          <span>
                            <span className="font-medium">{scope.name}</span>
                            <span className="block text-xs text-slate-500 dark:text-slate-400">{scope.description || "No description"}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <DialogClose asChild>
                      <Button type="button" disabled={creating}>Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={creating}>{creating ? "Creating..." : "Create Access Token"}</Button>
                  </div>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-medium">Active Tokens</h3>
          <Button type="button" onClick={() => loadData()}>Refresh</Button>
        </div>
        {loading ? <p className="text-sm">Loading access tokens...</p> : null}
        {!loading && items.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No active tokens.</p> : null}
        <div className="grid gap-2">
          {items.map((item) => (
            <div key={item.id} className="rounded border border-slate-200 p-3 text-sm dark:border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{item.name}</p>
                <Button type="button" onClick={() => onRevoke(item)} disabled={revokingId === item.id}>
                  {revokingId === item.id ? "Revoking..." : "Revoke"}
                </Button>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Scopes: {item.scopes.join(" ") || "none"}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Created: {new Date(item.createdAt).toLocaleString()}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Expires: {item.expiresAt ? new Date(item.expiresAt).toLocaleString() : "Never"}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function AccessTokensRoutePage() {
  const routeContext = useAppRouteRenderContext();
  if (!routeContext.isAuthenticated) {
    return null;
  }
  return <AccessTokensPage accessToken={routeContext.settingsProps.accessToken} />;
}
