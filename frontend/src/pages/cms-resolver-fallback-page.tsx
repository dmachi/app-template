import { useEffect, useMemo, useState } from "react";

import { Button } from "../components/ui/button";
import { MarkdownContent } from "../components/markdown-content";
import { useAppRouteRenderContext } from "../app/app-route-render-context";
import { resolveCmsPath, type CmsResolveResponse } from "../lib/api";

const rawResolverBlacklist =
  import.meta.env.VITE_FRONTEND_CMS_RESOLVER_BLACKLIST_PATTERNS
  ?? import.meta.env.FRONTEND_CMS_RESOLVER_BLACKLIST_PATTERNS
  ?? "/api/*,/settings/*,/login,/register,/verify-email,/accept-invite,/assets/*";

function compileWildcardPatterns(input: string): RegExp[] {
  return input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((pattern) => {
      const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
      return new RegExp(`^${escaped}$`);
    });
}

export default function CmsResolverFallbackPage() {
  const routeContext = useAppRouteRenderContext();
  const [payload, setPayload] = useState<CmsResolveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pathname = window.location.pathname;
  const blacklistPatterns = useMemo(() => compileWildcardPatterns(rawResolverBlacklist), []);

  useEffect(() => {
    if (pathname.startsWith("/cms/")) {
      setLoading(false);
      setError("Page not found");
      return;
    }

    if (blacklistPatterns.some((pattern) => pattern.test(pathname))) {
      setLoading(false);
      setError("Page not found");
      return;
    }

    setLoading(true);
    setError(null);
    resolveCmsPath(pathname, routeContext.isAuthenticated ? routeContext.settingsProps.accessToken : null)
      .then((nextPayload) => {
        setPayload(nextPayload);
        if (nextPayload.canonicalUrl && window.location.pathname !== nextPayload.canonicalUrl) {
          routeContext.settingsProps.navigateTo(nextPayload.canonicalUrl, true);
        }
      })
      .catch(() => {
        setPayload(null);
        setError("Page not found");
      })
      .finally(() => setLoading(false));
  }, [blacklistPatterns, pathname, routeContext.isAuthenticated, routeContext.settingsProps.accessToken, routeContext.settingsProps.navigateTo]);

  if (loading) {
    return <p className="text-sm">Loading page...</p>;
  }

  if (error || !payload) {
    return (
      <section className="grid gap-2">
        <h2 className="text-lg font-medium">404</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">The requested page was not found.</p>
        <div>
          <Button type="button" className="bg-transparent" onClick={() => routeContext.settingsProps.navigateTo("/")}>Go Home</Button>
        </div>
      </section>
    );
  }

  const canEdit = routeContext.isAuthenticated && routeContext.settingsProps.adminCapabilities.content;

  return (
    <section className="grid gap-3">
      {payload.content.status !== "published" && routeContext.isAuthenticated ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          Preview mode: this content is not published.
        </div>
      ) : null}

      {canEdit ? (
        <div>
          <Button type="button" className="bg-transparent" onClick={() => routeContext.settingsProps.navigateTo(`/settings/admin/content/${payload.content.id}`)}>
            Edit this page
          </Button>
        </div>
      ) : null}

      <article className="grid gap-3 rounded-md border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <h1 className="text-2xl font-semibold">{payload.content.name}</h1>
        <MarkdownContent className="prose prose-slate max-w-none dark:prose-invert" content={payload.content.content} />
      </article>
    </section>
  );
}