import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Pencil } from "lucide-react";

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
import { createCmsContent, listCmsContent, listCmsContentTypes, type CmsContentItem } from "../../../lib/api";

type AdminContentPageProps = {
  accessToken: string;
  canCreate: boolean;
  canOpen: boolean;
  onOpenContent: (contentId: string) => void;
  onOpenPublicContent: (contentTypeKey: string, contentId: string) => void;
};

function formatCreatedAt(value: string | null): string {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleDateString();
}

function statusBadgeClasses(status: string): string {
  if (status === "published") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  if (status === "archived") {
    return "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
  return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
}

export function AdminContentPage({ accessToken, canCreate, canOpen, onOpenContent, onOpenPublicContent }: AdminContentPageProps) {
  const [items, setItems] = useState<CmsContentItem[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [contentTypes, setContentTypes] = useState<Array<{ key: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createTypeKey, setCreateTypeKey] = useState("page");
  const [creatingDraft, setCreatingDraft] = useState(false);

  async function loadData() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [contentPayload, typesPayload] = await Promise.all([
        listCmsContent(accessToken),
        listCmsContentTypes(),
      ]);
      setItems(Array.isArray(contentPayload.items) ? contentPayload.items : []);
      const nextTypes = (typesPayload.items || []).map((item) => ({ key: item.key, label: item.label }));
      setContentTypes(nextTypes);
      if (nextTypes.length > 0) {
        setCreateTypeKey((current) => {
          if (nextTypes.some((entry) => entry.key === current)) {
            return current;
          }
          return nextTypes[0].key;
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load content";
      setErrorMessage(message);
      showClientToast({ title: "Content", message, severity: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch(() => {
      setLoading(false);
    });
  }, [accessToken]);

  async function handleCreate() {
    if (!canCreate || !createTypeKey) {
      return;
    }

    const selectedType = contentTypes.find((item) => item.key === createTypeKey) || null;
    setCreatingDraft(true);
    try {
      const created = await createCmsContent(accessToken, {
        contentTypeKey: createTypeKey,
        name: `Untitled ${selectedType?.label || "Content"}`,
        content: "",
        visibility: "public",
      });
      setCreateDialogOpen(false);
      showClientToast({ title: "Content", message: "Draft created", severity: "success" });
      onOpenContent(created.id);
    } catch (error) {
      showClientToast({ title: "Content", message: error instanceof Error ? error.message : "Unable to create draft", severity: "error" });
    } finally {
      setCreatingDraft(false);
    }
  }

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      if (typeFilter !== "all" && item.contentTypeKey !== typeFilter) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const publicPath = `/cms/${item.contentTypeKey}/${item.id}`;
      return [item.name, item.contentTypeKey, item.status, publicPath].some((value) => value.toLowerCase().includes(needle));
    });
  }, [items, query, statusFilter, typeFilter]);

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Content</h2>
        {canCreate ? (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" disabled={contentTypes.length === 0}>Create Draft</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Draft</DialogTitle>
                <DialogDescription>Select a content type for the new draft.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-3">
                <label className="grid gap-1 text-sm">
                  <span>Content type</span>
                  <select
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                    value={createTypeKey}
                    onChange={(event) => setCreateTypeKey(event.target.value)}
                    disabled={creatingDraft}
                  >
                    {contentTypes.map((type) => (
                      <option key={type.key} value={type.key}>{type.label}</option>
                    ))}
                  </select>
                </label>

                <div className="flex justify-end gap-2">
                  <DialogClose asChild>
                    <Button type="button" disabled={creatingDraft}>Cancel</Button>
                  </DialogClose>
                  <Button type="button" onClick={() => void handleCreate()} disabled={creatingDraft || !createTypeKey}>
                    {creatingDraft ? "Creating..." : "Create Draft"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_170px_170px]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, type, status, or public path"
          />
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="all">All types</option>
            {contentTypes.map((type) => (
              <option key={type.key} value={type.key}>{type.label}</option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {loading ? <p className="text-sm">Loading content...</p> : null}
        {!loading && errorMessage ? (
          <div className="grid gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/40">
            <p className="text-sm text-rose-700 dark:text-rose-300">Unable to load content: {errorMessage}</p>
            <div>
              <Button type="button" className="bg-transparent" onClick={() => void loadData()}>Retry</Button>
            </div>
          </div>
        ) : null}
        {!loading && !errorMessage ? (
          <div className="grid gap-2">
            <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[140px_minmax(0,1fr)_130px_120px_48px_48px] items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  <span>Type</span>
                  <span>Name</span>
                  <span>Created</span>
                  <span>State</span>
                  <span className="text-center">Edit</span>
                  <span className="text-center">Open</span>
                </div>

                {filteredItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-[140px_minmax(0,1fr)_130px_120px_48px_48px] items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-sm last:border-b-0 dark:border-slate-800">
                    <span className="truncate text-xs text-slate-600 dark:text-slate-300">{item.contentTypeKey}</span>
                    <span className="truncate font-medium" title={item.name}>{item.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{formatCreatedAt(item.createdAt)}</span>
                    <span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${statusBadgeClasses(item.status)}`}>
                        {item.status}
                      </span>
                    </span>
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        className="bg-transparent"
                        onClick={() => onOpenContent(item.id)}
                        aria-label={`Edit ${item.name}`}
                        title="Edit"
                        disabled={!canOpen}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        className="bg-transparent"
                        onClick={() => onOpenPublicContent(item.contentTypeKey, item.id)}
                        aria-label={`Open ${item.name}`}
                        title="Open"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No content items yet.{canCreate ? " Create your first draft to get started." : ""}
              </p>
            ) : null}
            {items.length > 0 && filteredItems.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No content matches the current filter.</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function AdminContentRoutePage() {
  const routeContext = useAppRouteRenderContext();
  if (!routeContext.isAuthenticated) {
    return null;
  }

  return (
    <AdminContentPage
      accessToken={routeContext.settingsProps.accessToken}
      canCreate={routeContext.settingsProps.adminCapabilities.content}
      canOpen={routeContext.settingsProps.adminCapabilities.content}
      onOpenContent={(contentId) => routeContext.settingsProps.navigateTo(`/settings/admin/content/${contentId}`)}
      onOpenPublicContent={(contentTypeKey, contentId) => routeContext.settingsProps.navigateTo(`/cms/${contentTypeKey}/${contentId}`)}
    />
  );
}