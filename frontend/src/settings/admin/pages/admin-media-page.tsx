import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { useAppRouteRenderContext } from "../../../app/app-route-render-context";
import { listMediaImages, getMediaImageUrl, type MediaImageItem } from "../../../lib/api";
import { showClientToast } from "../../../lib/client-toast";

type AdminMediaPageProps = {
  accessToken: string;
  canDelete: boolean;
  onDeleteMedia?: (mediaId: string) => void;
};

function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminMediaPage({ accessToken, canDelete, onDeleteMedia }: AdminMediaPageProps) {
  const [items, setItems] = useState<MediaImageItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const payload = await listMediaImages(accessToken);
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load media";
      setErrorMessage(message);
      showClientToast({ title: "Media", message, severity: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch(() => {
      setLoading(false);
    });
  }, [accessToken]);

  async function handleDelete(mediaId: string) {
    if (!canDelete) {
      return;
    }
    if (!window.confirm("Are you sure you want to delete this media?")) {
      return;
    }

    setDeletingId(mediaId);
    try {
      const response = await fetch(`/api/v1/media/images/${encodeURIComponent(mediaId)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Delete failed: ${response.statusText}`);
      }
      setItems((prev) => prev.filter((item) => item.id !== mediaId));
      showClientToast({ title: "Media", message: "Media deleted", severity: "success" });
      onDeleteMedia?.(mediaId);
    } catch (error) {
      showClientToast({
        title: "Media",
        message: error instanceof Error ? error.message : "Unable to delete media",
        severity: "error",
      });
    } finally {
      setDeletingId(null);
    }
  }

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return items;
    }
    return items.filter((item) => [item.filename, item.altText || "", item.title || ""].some((value) => value.toLowerCase().includes(needle)));
  }, [items, query]);

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Media</h2>
        <span className="text-sm text-slate-500 dark:text-slate-400">{items.length} item{items.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="grid gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by filename, alt text, title" />

        {loading ? <p className="text-sm">Loading media...</p> : null}
        {!loading && errorMessage ? (
          <div className="grid gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/40">
            <p className="text-sm text-rose-700 dark:text-rose-300">Unable to load media: {errorMessage}</p>
            <div>
              <Button type="button" className="bg-transparent" onClick={() => void loadData()}>
                Retry
              </Button>
            </div>
          </div>
        ) : null}
        {!loading && !errorMessage ? (
          <div className="grid gap-2">
            {query && filteredItems.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No media matches your search.</p>
            ) : filteredItems.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No media uploaded yet.</p>
            ) : (
              filteredItems.map((item) => (
                <div key={item.id} className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
                  <div className="grid gap-2 md:grid-cols-[80px_1fr_auto]">
                    {/* Thumbnail */}
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                      <img src={getMediaImageUrl(item.id)} alt={item.altText || item.filename} className="h-full w-full object-cover" />
                    </div>

                    {/* Details */}
                    <div className="grid gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="grid gap-0.5">
                          <span className="font-medium">{item.filename}</span>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {item.contentType} · {formatFileSize(item.byteSize)} · Uploaded {formatDate(item.createdAt)}
                          </p>
                        </div>
                      </div>
                      {item.altText ? <p className="text-xs text-slate-600 dark:text-slate-400">Alt: {item.altText}</p> : null}
                      {item.title ? <p className="text-xs text-slate-600 dark:text-slate-400">Title: {item.title}</p> : null}
                      {item.tags && item.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.tags.map((tag) => (
                            <span key={tag} className="inline-block rounded-full bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-700">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {/* Actions */}
                    {canDelete ? (
                      <div className="flex items-center justify-end">
                        <Button
                          type="button"
                          className="bg-transparent text-rose-600 hover:text-rose-700 dark:text-rose-400"
                          onClick={() => void handleDelete(item.id)}
                          disabled={deletingId === item.id}
                        >
                          {deletingId === item.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function AdminMediaRoutePage() {
  const routeContext = useAppRouteRenderContext();
  if (!routeContext.isAuthenticated) {
    return null;
  }

  return (
    <AdminMediaPage
      accessToken={routeContext.settingsProps.accessToken}
      canDelete={routeContext.settingsProps.adminCapabilities.content}
    />
  );
}
