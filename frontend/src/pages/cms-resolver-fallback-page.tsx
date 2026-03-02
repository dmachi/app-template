import { useEffect, useState } from "react";

import { Button } from "../components/ui/button";
import { useAppRouteRenderContext } from "../app/app-route-render-context";

export default function CmsResolverFallbackPage() {
  const routeContext = useAppRouteRenderContext();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
    return <p className="text-sm">Loading page...</p>;
  }

  return (
    <section className="grid gap-2">
      <h2 className="text-lg font-medium">404</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">The requested page was not found.</p>
      <div>
        <Button type="button" className="bg-transparent" onClick={() => routeContext.settingsProps.navigateTo("/")}>Go Home</Button>
      </div>
      {routeContext.isAuthenticated && routeContext.settingsProps.adminCapabilities.content ? (
        <div>
          <Button type="button" className="bg-transparent" onClick={() => routeContext.settingsProps.navigateTo("/settings/admin/content")}>
            Open Content Admin
          </Button>
        </div>
      ) : null}
    </section>
  );
}