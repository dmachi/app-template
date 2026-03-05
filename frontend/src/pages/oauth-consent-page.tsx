import { useEffect, useMemo, useState } from "react";

import { useAppRouteRenderContext } from "../app/app-route-render-context";
import { Button } from "../components/ui/button";
import { getOAuthConsentDetails, submitOAuthConsentDecision } from "../lib/api";

type ConsentDetails = {
  returnTo: string;
  clientId: string;
  clientName: string;
  scopes: string[];
};

export default function OAuthConsentPage() {
  const routeContext = useAppRouteRenderContext();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<ConsentDetails | null>(null);

  const returnTo = useMemo(() => {
    const search = new URLSearchParams(window.location.search);
    return search.get("return_to") || "";
  }, []);

  useEffect(() => {
    if (!returnTo) {
      setLoading(false);
      setError("Missing OAuth return target.");
      return;
    }

    if (!routeContext.isAuthenticated) {
      const loginSearch = new URLSearchParams({ oauth_return_to: returnTo });
      window.location.href = `/login?${loginSearch.toString()}`;
      return;
    }

    setLoading(true);
    getOAuthConsentDetails(routeContext.settingsProps.accessToken, returnTo)
      .then((payload) => {
        setDetails(payload);
        setError(null);
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load consent details");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [returnTo, routeContext.isAuthenticated, routeContext.settingsProps.accessToken]);

  async function onDecision(decision: "approve" | "deny") {
    if (!details || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitOAuthConsentDecision(routeContext.settingsProps.accessToken, details.returnTo, decision);
      window.location.href = result.redirectUrl;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit consent decision");
      setSubmitting(false);
    }
  }

  return (
    <div className="grid w-full max-w-xl gap-3">
      <h2 className="text-xl font-medium">Authorize Application</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">Review requested permissions before continuing.</p>

      <div className="grid gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        {loading ? <p className="text-sm">Loading consent details...</p> : null}

        {!loading && details ? (
          <>
            <div className="grid gap-1">
              <p className="text-sm font-medium">Application</p>
              <p className="text-sm">{details.clientName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{details.clientId}</p>
            </div>

            <div className="grid gap-1">
              <p className="text-sm font-medium">Requested scopes</p>
              <ul className="grid gap-1 text-sm">
                {details.scopes.map((scope) => (
                  <li key={scope} className="rounded border border-slate-200 px-2 py-1 dark:border-slate-700">
                    {scope}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void onDecision("approve")} disabled={submitting}>
                {submitting ? "Submitting..." : "Grant Access"}
              </Button>
              <Button type="button" onClick={() => void onDecision("deny")} disabled={submitting}>
                Deny
              </Button>
            </div>
          </>
        ) : null}

        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      </div>
    </div>
  );
}
