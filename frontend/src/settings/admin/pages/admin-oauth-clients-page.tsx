import { useEffect, useState } from "react";

import { useAppRouteRenderContext } from "../../../app/app-route-render-context";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { showClientToast } from "../../../lib/client-toast";
import {
  adminCreateOAuthClient,
  adminDeleteOAuthClient,
  adminListOAuthClients,
  adminPatchOAuthClient,
  type AdminOAuthClientItem,
} from "../../../lib/api";

type AdminOAuthClientsPageProps = {
  accessToken: string;
};

type OAuthClientFormState = {
  name: string;
  redirectUris: string;
  allowedScopes: string;
  allowRefreshGrant: boolean;
  trusted: boolean;
  tokenEndpointAuthMethod: "none" | "client_secret_post";
};

const DEFAULT_CREATE_FORM: OAuthClientFormState = {
  name: "",
  redirectUris: "https://example.com/callback",
  allowedScopes: "openid,profile,email",
  allowRefreshGrant: true,
  trusted: false,
  tokenEndpointAuthMethod: "none",
};

function splitCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AdminOAuthClientsPage({ accessToken }: AdminOAuthClientsPageProps) {
  const [items, setItems] = useState<AdminOAuthClientItem[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<OAuthClientFormState>(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState<OAuthClientFormState>(DEFAULT_CREATE_FORM);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  async function loadClients() {
    const payload = await adminListOAuthClients(accessToken);
    setItems(payload.items || []);
  }

  useEffect(() => {
    loadClients().catch((error) => {
      showClientToast({
        title: "OAuth Clients",
        message: error instanceof Error ? error.message : "Unable to load OAuth clients",
        severity: "error",
      });
    });
  }, [accessToken]);

  function buildFormStateFromClient(item: AdminOAuthClientItem): OAuthClientFormState {
    return {
      name: item.name,
      redirectUris: item.redirectUris.join(", "),
      allowedScopes: item.allowedScopes.join(", "),
      allowRefreshGrant: item.grantTypes.includes("refresh_token"),
      trusted: item.trusted,
      tokenEndpointAuthMethod: item.tokenEndpointAuthMethod === "client_secret_post" ? "client_secret_post" : "none",
    };
  }

  function openEditDialog(item: AdminOAuthClientItem) {
    setEditingClientId(item.clientId);
    setEditForm(buildFormStateFromClient(item));
    setEditDialogOpen(true);
  }

  async function handleCreateClient() {
    if (!createForm.name.trim()) {
      showClientToast({ title: "OAuth Clients", message: "Name is required", severity: "warning" });
      return;
    }

    const redirectUriList = splitCommaSeparated(createForm.redirectUris);
    if (!redirectUriList.length) {
      showClientToast({ title: "OAuth Clients", message: "At least one redirect URI is required", severity: "warning" });
      return;
    }

    setSavingCreate(true);
    try {
      const created = await adminCreateOAuthClient(accessToken, {
        name: createForm.name.trim(),
        redirectUris: redirectUriList,
        allowedScopes: splitCommaSeparated(createForm.allowedScopes),
        grantTypes: createForm.allowRefreshGrant ? ["authorization_code", "refresh_token"] : ["authorization_code"],
        trusted: createForm.trusted,
        tokenEndpointAuthMethod: createForm.tokenEndpointAuthMethod,
      });
      await loadClients();
      setCreateForm(DEFAULT_CREATE_FORM);
      setCreateDialogOpen(false);
      showClientToast({ title: "OAuth Clients", message: "Client created", severity: "success" });
      if (created.clientSecret) {
        showClientToast({
          title: "OAuth Client Secret",
          message: `Copy now: ${created.clientSecret}`,
          severity: "info",
        });
      }
    } catch (error) {
      showClientToast({
        title: "OAuth Clients",
        message: error instanceof Error ? error.message : "Unable to create OAuth client",
        severity: "error",
      });
    } finally {
      setSavingCreate(false);
    }
  }

  async function handleEditClient() {
    if (!editingClientId) {
      return;
    }
    if (!editForm.name.trim()) {
      showClientToast({ title: "OAuth Clients", message: "Name is required", severity: "warning" });
      return;
    }

    const redirectUriList = splitCommaSeparated(editForm.redirectUris);
    if (!redirectUriList.length) {
      showClientToast({ title: "OAuth Clients", message: "At least one redirect URI is required", severity: "warning" });
      return;
    }

    setSavingEdit(true);
    try {
      await adminPatchOAuthClient(accessToken, editingClientId, {
        name: editForm.name.trim(),
        redirectUris: redirectUriList,
        allowedScopes: splitCommaSeparated(editForm.allowedScopes),
        grantTypes: editForm.allowRefreshGrant ? ["authorization_code", "refresh_token"] : ["authorization_code"],
        trusted: editForm.trusted,
        tokenEndpointAuthMethod: editForm.tokenEndpointAuthMethod,
      });
      await loadClients();
      setEditDialogOpen(false);
      showClientToast({ title: "OAuth Clients", message: "Client updated", severity: "success" });
    } catch (error) {
      showClientToast({
        title: "OAuth Clients",
        message: error instanceof Error ? error.message : "Unable to update OAuth client",
        severity: "error",
      });
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleRotateSecret(item: AdminOAuthClientItem) {
    try {
      const updated = await adminPatchOAuthClient(accessToken, item.clientId, { rotateSecret: true });
      showClientToast({ title: "OAuth Clients", message: "Secret rotated", severity: "success" });
      if (updated.clientSecret) {
        showClientToast({
          title: "OAuth Client Secret",
          message: `Copy now: ${updated.clientSecret}`,
          severity: "info",
        });
      }
    } catch (error) {
      showClientToast({
        title: "OAuth Clients",
        message: error instanceof Error ? error.message : "Unable to rotate secret",
        severity: "error",
      });
    }
  }

  async function handleDeleteClient(item: AdminOAuthClientItem) {
    try {
      await adminDeleteOAuthClient(accessToken, item.clientId);
      await loadClients();
      showClientToast({ title: "OAuth Clients", message: "Client deleted", severity: "success" });
    } catch (error) {
      showClientToast({
        title: "OAuth Clients",
        message: error instanceof Error ? error.message : "Unable to delete OAuth client",
        severity: "error",
      });
    }
  }

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">OAuth Clients</h2>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button">Create OAuth Client</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create OAuth Client</DialogTitle>
              <DialogDescription>Provide client details for external app integration.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span>Name</span>
                <Input value={createForm.name} onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="My Integration" />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Redirect URIs (comma-separated)</span>
                <Input
                  value={createForm.redirectUris}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, redirectUris: event.target.value }))}
                  placeholder="https://example.com/callback"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Allowed scopes (comma-separated)</span>
                <Input
                  value={createForm.allowedScopes}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, allowedScopes: event.target.value }))}
                  placeholder="openid,profile,email"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Token endpoint auth method</span>
                <select
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={createForm.tokenEndpointAuthMethod}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, tokenEndpointAuthMethod: event.target.value as "none" | "client_secret_post" }))}
                >
                  <option value="none">none</option>
                  <option value="client_secret_post">client_secret_post</option>
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={createForm.trusted}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, trusted: event.target.checked }))}
                />
                <span>Trusted first-party client</span>
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={createForm.allowRefreshGrant}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, allowRefreshGrant: event.target.checked }))}
                />
                <span>Allow refresh_token grant</span>
              </label>

              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button type="button" disabled={savingCreate}>Cancel</Button>
                </DialogClose>
                <Button type="button" onClick={() => void handleCreateClient()} disabled={savingCreate}>
                  {savingCreate ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-2 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <h3 className="text-sm font-medium">Registered clients</h3>
        {items.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No OAuth clients yet.</p> : null}

        {items.map((item) => (
          <div key={item.clientId} className="grid gap-2 rounded border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{item.name}</p>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{item.clientId}</span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{item.tokenEndpointAuthMethod}</span>
              {item.trusted ? <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">trusted</span> : null}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">Redirect URIs: {item.redirectUris.join(", ")}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Scopes: {item.allowedScopes.join(", ")}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Grant types: {item.grantTypes.join(", ")}</p>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => openEditDialog(item)}>
                Edit
              </Button>
              {item.tokenEndpointAuthMethod === "client_secret_post" ? (
                <Button type="button" onClick={() => handleRotateSecret(item)}>
                  Rotate Secret
                </Button>
              ) : null}
              <Button type="button" onClick={() => handleDeleteClient(item)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit OAuth Client</DialogTitle>
            <DialogDescription>Update OAuth client configuration.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span>Name</span>
              <Input value={editForm.name} onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="My Integration" />
            </label>

            <label className="grid gap-1 text-sm">
              <span>Redirect URIs (comma-separated)</span>
              <Input
                value={editForm.redirectUris}
                onChange={(event) => setEditForm((prev) => ({ ...prev, redirectUris: event.target.value }))}
                placeholder="https://example.com/callback"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span>Allowed scopes (comma-separated)</span>
              <Input
                value={editForm.allowedScopes}
                onChange={(event) => setEditForm((prev) => ({ ...prev, allowedScopes: event.target.value }))}
                placeholder="openid,profile,email"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span>Token endpoint auth method</span>
              <select
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={editForm.tokenEndpointAuthMethod}
                onChange={(event) => setEditForm((prev) => ({ ...prev, tokenEndpointAuthMethod: event.target.value as "none" | "client_secret_post" }))}
              >
                <option value="none">none</option>
                <option value="client_secret_post">client_secret_post</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={editForm.trusted}
                onChange={(event) => setEditForm((prev) => ({ ...prev, trusted: event.target.checked }))}
              />
              <span>Trusted first-party client</span>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={editForm.allowRefreshGrant}
                onChange={(event) => setEditForm((prev) => ({ ...prev, allowRefreshGrant: event.target.checked }))}
              />
              <span>Allow refresh_token grant</span>
            </label>

            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" disabled={savingEdit}>Cancel</Button>
              </DialogClose>
              <Button type="button" onClick={() => void handleEditClient()} disabled={savingEdit}>
                {savingEdit ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default function AdminOAuthClientsRoutePage() {
  const routeContext = useAppRouteRenderContext();
  if (!routeContext.isAuthenticated) {
    return null;
  }
  return <AdminOAuthClientsPage accessToken={routeContext.settingsProps.accessToken} />;
}
