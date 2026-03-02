import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { listMediaImages, uploadMediaImage, getMediaImageUrl, type MediaImageItem } from "../../../lib/api";
import { showClientToast } from "../../../lib/client-toast";

type MediaSelectorDialogProps = {
  isOpen: boolean;
  accessToken: string;
  onClose: () => void;
  onSelectMedia: (items: MediaImageItem[]) => void;
  multiSelect?: boolean;
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

function formatDate(isoString: string | null): string {
  if (!isoString) {
    return "-";
  }
  return new Date(isoString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MediaSelectorDialog({ isOpen, accessToken, onClose, onSelectMedia, multiSelect = true }: MediaSelectorDialogProps) {
  const [items, setItems] = useState<MediaImageItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  async function loadMedia() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const payload = await listMediaImages(accessToken);
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load media";
      setErrorMessage(message);
      showClientToast({ title: "Media Selector", message, severity: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadMedia().catch(() => {
        setLoading(false);
      });
      setSelectedIds(new Set());
      setQuery("");
    }
  }, [isOpen, accessToken]);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return items;
    }
    return items.filter((item) => [item.filename, item.altText || "", item.title || ""].some((value) => value.toLowerCase().includes(needle)));
  }, [items, query]);

  function toggleSelect(mediaId: string) {
    if (!multiSelect) {
      setSelectedIds(new Set([mediaId]));
      return;
    }
    const updated = new Set(selectedIds);
    if (updated.has(mediaId)) {
      updated.delete(mediaId);
    } else {
      updated.add(mediaId);
    }
    setSelectedIds(updated);
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.currentTarget.files;
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];
    if (!file.type.startsWith("image/")) {
      showClientToast({ title: "Media Selector", message: "Only image files are supported", severity: "error" });
      return;
    }

    setUploadingFile(true);
    setUploadProgress("Uploading...");

    try {
      const uploaded = await uploadMediaImage(accessToken, file);
      setItems((prev) => [uploaded, ...prev]);
      setUploadProgress(null);
      showClientToast({ title: "Media Selector", message: "Image uploaded successfully", severity: "success" });
      
      // Auto-select newly uploaded image
      if (!multiSelect) {
        setSelectedIds(new Set([uploaded.id]));
      } else {
        setSelectedIds((prev) => new Set([...prev, uploaded.id]));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setUploadProgress(null);
      showClientToast({ title: "Media Selector", message, severity: "error" });
    } finally {
      setUploadingFile(false);
      event.currentTarget.value = "";
    }
  }

  function handleSelect() {
    const selected = items.filter((item) => selectedIds.has(item.id));
    if (selected.length === 0) {
      showClientToast({ title: "Media Selector", message: "Please select at least one image", severity: "warning" });
      return;
    }
    onSelectMedia(selected);
    onClose();
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-white dark:bg-slate-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-lg font-medium">Select Media</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="grid gap-4">
            {/* Search and Upload */}
            <div className="grid gap-2">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by filename, alt text, or title" />

              <div className="flex items-center gap-2">
                <label className="flex flex-1 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600">
                  <input type="file" accept="image/*" onChange={handleFileUpload} disabled={uploadingFile} className="hidden" />
                  {uploadProgress ? uploadProgress : "📁 Click to upload new image"}
                </label>
              </div>
            </div>

            {/* Media List */}
            {loading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading media...</p>
            ) : errorMessage ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/40">
                <p className="text-sm text-rose-700 dark:text-rose-300">Error: {errorMessage}</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {query ? "No media matches your search." : "No media uploaded yet. Upload an image above to get started."}
              </p>
            ) : (
              <div className="grid gap-2 max-h-96 overflow-y-auto">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggleSelect(item.id)}
                    className={`grid cursor-pointer gap-2 rounded-md border p-3 transition-colors md:grid-cols-[80px_1fr_auto] ${
                      selectedIds.has(item.id)
                        ? "border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/40"
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                    }`}
                  >
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
                            {item.contentType} · {formatFileSize(item.byteSize)} · {formatDate(item.createdAt)}
                          </p>
                        </div>
                      </div>
                      {item.altText ? <p className="text-xs text-slate-600 dark:text-slate-400">Alt: {item.altText}</p> : null}
                      {item.title ? <p className="text-xs text-slate-600 dark:text-slate-400">Title: {item.title}</p> : null}
                    </div>

                    {/* Selection Indicator */}
                    <div className="flex items-center justify-end">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded border ${
                          selectedIds.has(item.id) ? "border-blue-500 bg-blue-500" : "border-slate-300 dark:border-slate-600"
                        }`}
                      >
                        {selectedIds.has(item.id) ? <span className="text-sm font-bold text-white">✓</span> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
          <Button type="button" className="bg-transparent" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSelect} disabled={selectedIds.size === 0 || loading || uploadingFile}>
            Insert {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}&nbsp;Image{selectedIds.size !== 1 ? "s" : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}
