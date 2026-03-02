import { FormEvent, useEffect, useState } from "react";

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
import { useAppRouteRenderContext } from "../../../app/app-route-render-context";
import { showClientToast } from "../../../lib/client-toast";
import {
  adminCreateCmsContentType,
  adminPatchCmsContentType,
  listCmsContentTypes,
  type CmsContentType,
} from "../../../lib/api";

function toKeyFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminContentTypesRoutePage() {
  const routeContext = useAppRouteRenderContext();
  const accessToken = routeContext.settingsProps.accessToken;
  const canManageTypes = routeContext.settingsProps.adminCapabilities.contentTypes;

  const [items, setItems] = useState<CmsContentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const payload = await listCmsContentTypes();
      setItems(payload.items || []);
    } catch (error) {
      showClientToast({ title: "Content Types", message: error instanceof Error ? error.message : "Unable to load content types", severity: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch(() => setLoading(false));
  }, []);

  async function createType(event: FormEvent) {
    event.preventDefault();
    if (!canManageTypes || !newName.trim()) {
      return;
    }

    const key = toKeyFromName(newName);
    if (!key) {
      showClientToast({ title: "Content Types", message: "Name must include letters or numbers", severity: "error" });
      return;
    }

    setCreating(true);
    try {
      const created = await adminCreateCmsContentType(accessToken, {
        key,
        label: newName.trim(),
        description: newDescription.trim() || undefined,
        fieldDefinitions: [],
      });
      setNewName("");
      setNewDescription("");
      setDialogOpen(false);
      showClientToast({ title: "Content Types", message: "Created", severity: "success" });
      routeContext.settingsProps.navigateTo(`/settings/admin/content-types/${created.key}`);
    } catch (error) {
      showClientToast({ title: "Content Types", message: error instanceof Error ? error.message : "Unable to create content type", severity: "error" });
    } finally {
      setCreating(false);
    }
  }

  async function toggleType(item: CmsContentType) {
    if (!canManageTypes) {
      return;
    }
    const nextStatus = item.status === "active" ? "disabled" : "active";
    setUpdatingKey(item.key);
    try {
      await adminPatchCmsContentType(accessToken, item.key, {
        status: nextStatus,
      });
      await loadData();
      showClientToast({ title: "Content Types", message: "Updated", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Content Types", message: error instanceof Error ? error.message : "Unable to update content type", severity: "error" });
    } finally {
      setUpdatingKey(null);
    }
  }

  if (!routeContext.isAuthenticated) {
    return null;
  }

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Content Types</h2>
        {canManageTypes ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button">Add Content Type</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Content Type</DialogTitle>
                <DialogDescription>Enter a name and optional description. You can add fields on the next screen.</DialogDescription>
              </DialogHeader>

              <form onSubmit={(event) => void createType(event)} className="grid gap-3">
                <label className="grid gap-1 text-sm">
                  <span>Name</span>
                  <Input placeholder="e.g. Article" value={newName} onChange={(event) => setNewName(event.target.value)} required />
                </label>
                <label className="grid gap-1 text-sm">
                  <span>Description (optional)</span>
                  <Input placeholder="What this content type is for" value={newDescription} onChange={(event) => setNewDescription(event.target.value)} />
                </label>

                <div className="flex justify-end gap-2">
                  <DialogClose asChild>
                    <Button type="button" disabled={creating}>Cancel</Button>
                  </DialogClose>
                  <Button type="submit" disabled={creating || !newName.trim()}>
                    {creating ? "Creating..." : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        {loading ? <p className="text-sm">Loading content types...</p> : null}
        {!loading ? (
          <div className="grid gap-2">
            {items.map((item) => (
              <div key={item.key} className="grid gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.label} <span className="text-xs text-slate-500 dark:text-slate-400">({item.key})</span></p>
                    {item.description ? <p className="text-sm text-slate-600 dark:text-slate-300">{item.description}</p> : null}
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.status}{item.systemManaged ? " · built-in" : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" className="bg-transparent" onClick={() => routeContext.settingsProps.navigateTo(`/settings/admin/content-types/${item.key}`)}>
                      Open
                    </Button>
                    {canManageTypes ? (
                      <Button
                        type="button"
                        className="bg-transparent"
                        onClick={() => void toggleType(item)}
                        disabled={Boolean(updatingKey) || (item.systemManaged && item.status === "active")}
                      >
                        {updatingKey === item.key ? "Updating..." : item.status === "active" ? "Disable" : "Enable"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {items.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No content types found.</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}