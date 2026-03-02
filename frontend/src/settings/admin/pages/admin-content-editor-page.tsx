import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useMatchRoute } from "@tanstack/react-router";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { ContentTypeAdditionalFields } from "../components/content-type-additional-fields";
import { MediaSelectorDialog } from "../components/media-selector-dialog";
import { useAppRouteRenderContext } from "../../../app/app-route-render-context";
import { showClientToast } from "../../../lib/client-toast";
import {
  type CmsFieldDefinition,
  deleteCmsContent,
  getCmsContentById,
  getMediaImageUrl,
  listCmsContentTypes,
  listMediaImages,
  patchCmsContent,
  publishCmsContent,
  type MediaImageItem,
  unpublishCmsContent,
} from "../../../lib/api";

const LazyByteMdEditor = lazy(() => import("../components/lazy-bytemd-editor"));

function normalizeAliasInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const startsWithSlash = trimmed.startsWith("/");
  const normalized = `${startsWithSlash ? "" : "/"}${trimmed}`.toLowerCase().replace(/\/{2,}/g, "/");
  if (normalized !== "/" && normalized.endsWith("/")) {
    return normalized.replace(/\/+$/, "");
  }
  return normalized;
}

function isValidAlias(value: string): boolean {
  if (!value) {
    return true;
  }
  return /^\/[a-z0-9\-/]*$/.test(value);
}

export default function AdminContentEditorRoutePage() {
  const routeContext = useAppRouteRenderContext();
  const matchRoute = useMatchRoute() as (options: { to: string; fuzzy?: boolean }) => Record<string, string> | false;
  const match = matchRoute({ to: "/settings/admin/content/$contentId", fuzzy: false }) as { contentId?: string } | false;
  const contentId = match?.contentId || null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [aliasPathInput, setAliasPathInput] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [contentTypeKey, setContentTypeKey] = useState("page");
  const [availableTypes, setAvailableTypes] = useState<Array<{ key: string; label: string }>>([]);
  const [fieldDefinitions, setFieldDefinitions] = useState<CmsFieldDefinition[]>([]);
  const [additionalFields, setAdditionalFields] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState("draft");
  const [mediaItems, setMediaItems] = useState<MediaImageItem[]>([]);
  const [isMediaSelectorOpen, setIsMediaSelectorOpen] = useState(false);

  const accessToken = routeContext.settingsProps.accessToken;

  useEffect(() => {
    if (!routeContext.isAuthenticated || !contentId) {
      return;
    }
    setLoading(true);
    Promise.all([
      getCmsContentById(accessToken, contentId),
      listCmsContentTypes(),
      listMediaImages(accessToken),
    ])
      .then(([item, types, media]) => {
        setName(item.name || "");
        setContent(item.content || "");
        setAdditionalFields(item.additionalFields || {});
        setAliasPathInput(item.aliasPath || "");
        setVisibility(item.visibility || "public");
        setContentTypeKey(item.contentTypeKey || "page");
        setStatus(item.status || "draft");
        const nextTypes = types.items || [];
        setAvailableTypes(nextTypes.map((type) => ({ key: type.key, label: type.label })));
        const selectedType = nextTypes.find((type) => type.key === item.contentTypeKey);
        setFieldDefinitions(selectedType?.fieldDefinitions || []);
        setMediaItems(media.items || []);
      })
      .catch((error) => {
        showClientToast({ title: "Content", message: error instanceof Error ? error.message : "Unable to load content", severity: "error" });
      })
      .finally(() => setLoading(false));
  }, [accessToken, contentId, routeContext.isAuthenticated]);

  const normalizedAlias = useMemo(() => normalizeAliasInput(aliasPathInput), [aliasPathInput]);
  const aliasValid = useMemo(() => isValidAlias(normalizedAlias || ""), [normalizedAlias]);
  const contentTypeLabel = useMemo(
    () => availableTypes.find((type) => type.key === contentTypeKey)?.label || contentTypeKey || "Content",
    [availableTypes, contentTypeKey],
  );
  const previewPath = normalizedAlias || (contentId ? `/cms/${contentId}` : null);
  async function save() {
    if (!contentId || !aliasValid) {
      return;
    }
    setSaving(true);
    try {
      const updated = await patchCmsContent(accessToken, contentId, {
        name,
        content,
        additionalFields,
        aliasPath: normalizedAlias,
        visibility,
      });
      setStatus(updated.status);
      setAdditionalFields(updated.additionalFields || {});
      setAliasPathInput(updated.aliasPath || "");
      showClientToast({ title: "Content", message: "Draft saved", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Content", message: error instanceof Error ? error.message : "Unable to save content", severity: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!contentId) {
      return;
    }
    setSaving(true);
    try {
      const updated = await publishCmsContent(accessToken, contentId);
      setStatus(updated.status);
      showClientToast({ title: "Content", message: "Published", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Content", message: error instanceof Error ? error.message : "Unable to publish", severity: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function unpublish() {
    if (!contentId) {
      return;
    }
    setSaving(true);
    try {
      const updated = await unpublishCmsContent(accessToken, contentId);
      setStatus(updated.status);
      showClientToast({ title: "Content", message: "Unpublished", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Content", message: error instanceof Error ? error.message : "Unable to unpublish", severity: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!contentId) {
      return;
    }
    if (!window.confirm("Delete this content item?")) {
      return;
    }
    setSaving(true);
    try {
      await deleteCmsContent(accessToken, contentId);
      routeContext.settingsProps.navigateTo("/settings/admin/content", true);
      showClientToast({ title: "Content", message: "Deleted", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Content", message: error instanceof Error ? error.message : "Unable to delete content", severity: "error" });
    } finally {
      setSaving(false);
    }
  }

  function handleMediaSelectorClose() {
    setIsMediaSelectorOpen(false);
  }

  function handleMediaSelected(selectedMedia: MediaImageItem[]) {
    // Update media items list
    setMediaItems((current) => {
      const existingIds = new Set(current.map((item) => item.id));
      const merged = [...selectedMedia.filter((item) => !existingIds.has(item.id)), ...current];
      return merged;
    });

    const markdown = selectedMedia
      .map((item) => {
        const alt = item.altText || item.filename || "image";
        const title = item.title ? ` "${item.title.replace(/"/g, '\\"')}"` : "";
        return `![${alt}](${getMediaImageUrl(item.id)}${title})`;
      })
      .join("\n\n");

    setContent((prev) => (prev ? `${prev}\n\n${markdown}` : markdown));

    handleMediaSelectorClose();
  }

  if (!routeContext.isAuthenticated || !contentId) {
    return null;
  }

  if (loading) {
    return <p className="text-sm">Loading content editor...</p>;
  }

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">{contentTypeLabel} Editor</h2>
        <Button type="button" className="bg-transparent" onClick={() => routeContext.settingsProps.navigateTo("/settings/admin/content")}>Back to Content</Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">ID: {contentId}</span>
          {previewPath ? (
            <Button type="button" className="bg-transparent" onClick={() => routeContext.settingsProps.navigateTo(previewPath)}>
              Open Preview
            </Button>
          ) : null}
        </div>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {status}
        </span>
      </div>

      <div className="grid gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <div className="grid gap-2 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>Name</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Content Type</span>
            <select
              value={contentTypeKey}
              disabled
              className="h-10 rounded-md border border-slate-300 bg-slate-100 px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              onChange={(event) => setContentTypeKey(event.target.value)}
            >
              {availableTypes.map((type) => (
                <option key={type.key} value={type.key}>{type.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          <span>Alias Path</span>
          <Input value={aliasPathInput} onChange={(event) => setAliasPathInput(event.target.value)} placeholder="Optional (e.g. /about)" />
          {!aliasValid ? <span className="text-xs text-rose-600 dark:text-rose-400">Alias must start with "/" and include only lowercase letters, numbers, dashes, and slashes.</span> : null}
        </label>

        <label className="grid gap-1 text-sm">
          <span>Visibility</span>
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value)}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="public">Public</option>
            <option value="authenticated">Authenticated</option>
            <option value="roles">Roles</option>
          </select>
        </label>

        <ContentTypeAdditionalFields
          fieldDefinitions={fieldDefinitions}
          value={additionalFields}
          onChange={setAdditionalFields}
          mediaItems={mediaItems}
        />

        <label className="grid gap-1 text-sm">
          <span>Content (Markdown)</span>
          <div className="overflow-hidden rounded-md border border-slate-300 dark:border-slate-700">
            <Suspense fallback={<div className="p-3 text-xs text-slate-500 dark:text-slate-400">Loading editor...</div>}>
              <LazyByteMdEditor
                value={content}
                onChange={setContent}
                onOpenMediaSelector={() => setIsMediaSelectorOpen(true)}
                placeholder="Write markdown content..."
              />
            </Suspense>
          </div>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={save} disabled={saving || !aliasValid}>Save Draft</Button>
          <Button type="button" className="bg-transparent" onClick={publish} disabled={saving || status === "published"}>Publish</Button>
          <Button type="button" className="bg-transparent" onClick={unpublish} disabled={saving || status !== "published"}>Unpublish</Button>
          <Button type="button" className="bg-transparent" onClick={remove} disabled={saving}>Delete</Button>
        </div>
      </div>

      <MediaSelectorDialog
        isOpen={isMediaSelectorOpen}
        accessToken={accessToken}
        onClose={handleMediaSelectorClose}
        onSelectMedia={handleMediaSelected}
        multiSelect={true}
      />
    </section>
  );
}