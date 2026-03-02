import { useEffect, useState } from "react";
import { useMatchRoute } from "@tanstack/react-router";

import { Button } from "../components/ui/button";
import { MarkdownContent } from "../components/markdown-content";
import { useAppRouteRenderContext } from "../app/app-route-render-context";
import { getPublicCmsContentById, type CmsByIdResponse } from "../lib/api";

export default function CmsContentByIdPage() {
  const routeContext = useAppRouteRenderContext();
  const matchRoute = useMatchRoute() as (options: { to: string; fuzzy?: boolean }) => Record<string, string> | false;
  const match = matchRoute({ to: "/cms/$contentTypeKey/$contentId", fuzzy: false }) as { contentTypeKey?: string; contentId?: string } | false;
  const contentTypeKey = (match && match.contentTypeKey) || null;
  const contentId = (match && match.contentId) || null;
  const [payload, setPayload] = useState<CmsByIdResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contentTypeKey || !contentId) {
      setLoading(false);
      setError("Content not found");
      return;
    }

    setLoading(true);
    setError(null);
    getPublicCmsContentById(contentTypeKey, contentId, routeContext.isAuthenticated ? routeContext.settingsProps.accessToken : null)
      .then((nextPayload) => {
        setPayload(nextPayload);
        if (window.location.pathname !== nextPayload.canonicalUrl) {
          routeContext.settingsProps.navigateTo(nextPayload.canonicalUrl, true);
        }
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Unable to load content");
      })
      .finally(() => setLoading(false));
  }, [contentTypeKey, contentId, routeContext.isAuthenticated, routeContext.settingsProps.accessToken, routeContext.settingsProps.navigateTo]);

  if (loading) {
    return <p className="text-sm">Loading content...</p>;
  }

  if (error || !payload) {
    return (
      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Page Not Found</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">{error || "Content not found."}</p>
      </section>
    );
  }

  const canEdit = routeContext.isAuthenticated && routeContext.settingsProps.adminCapabilities.content;

  return (
    <section className="grid gap-3">
      {payload.preview ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          Preview mode: this content is not published.
        </div>
      ) : null}

      {canEdit ? (
        <div>
          <Button
            type="button"
            className="bg-transparent"
            onClick={() => routeContext.settingsProps.navigateTo(`/settings/admin/content/${payload.content.id}`)}
          >
            Edit this page
          </Button>
        </div>
      ) : null}

      <article className="grid gap-3 rounded-md bg-white p-0 dark:bg-slate-950">
        <h1 className="text-2xl font-semibold">{payload.content.name}</h1>
        <MarkdownContent className="prose prose-slate max-w-none dark:prose-invert" content={payload.content.content} />
      </article>
    </section>
  );
}