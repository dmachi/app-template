import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { useAppRouteRenderContext } from "../../../app/app-route-render-context";
import { showClientToast } from "../../../lib/client-toast";
import { adminCreateCmsContentType, adminPatchCmsContentType, listCmsContentTypes, type CmsContentType } from "../../../lib/api";

export default function AdminContentTypesRoutePage() {
  const routeContext = useAppRouteRenderContext();
  const accessToken = routeContext.settingsProps.accessToken;
  const canManageTypes = routeContext.settingsProps.adminCapabilities.contentTypes;

  const [items, setItems] = useState<CmsContentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);

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

  async function createType() {
    if (!canManageTypes || !newKey.trim() || !newLabel.trim()) {
      return;
    }
    setCreating(true);
    try {
      await adminCreateCmsContentType(accessToken, { key: newKey.trim().toLowerCase(), label: newLabel.trim() });
      setNewKey("");
      setNewLabel("");
      await loadData();
      showClientToast({ title: "Content Types", message: "Created", severity: "success" });
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
    try {
      await adminPatchCmsContentType(accessToken, item.key, { status: nextStatus });
      await loadData();
      showClientToast({ title: "Content Types", message: "Updated", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Content Types", message: error instanceof Error ? error.message : "Unable to update content type", severity: "error" });
    }
  }

  if (!routeContext.isAuthenticated) {
    return null;
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-medium">Content Types</h2>
      <div className="grid gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        {canManageTypes ? (
          <div className="grid gap-2 md:grid-cols-[160px_minmax(0,1fr)_auto]">
            <Input placeholder="key" value={newKey} onChange={(event) => setNewKey(event.target.value)} />
            <Input placeholder="label" value={newLabel} onChange={(event) => setNewLabel(event.target.value)} />
            <Button type="button" onClick={createType} disabled={creating || !newKey.trim() || !newLabel.trim()}>Create</Button>
          </div>
        ) : null}

        {loading ? <p className="text-sm">Loading content types...</p> : null}
        {!loading ? (
          <div className="grid gap-2">
            {items.map((item) => (
              <div key={item.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
                <div>
                  <p className="font-medium">{item.label} <span className="text-xs text-slate-500 dark:text-slate-400">({item.key})</span></p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.status}{item.systemManaged ? " · built-in" : ""}</p>
                </div>
                {canManageTypes ? (
                  <Button type="button" className="bg-transparent" onClick={() => toggleType(item)} disabled={item.systemManaged && item.status === "active"}>
                    {item.status === "active" ? "Disable" : "Enable"}
                  </Button>
                ) : null}
              </div>
            ))}
            {items.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No content types found.</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}