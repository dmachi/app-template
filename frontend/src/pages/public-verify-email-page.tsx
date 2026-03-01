import { Suspense, lazy } from "react";

import { useAppRouteRenderContext } from "../app/app-route-render-context";

const VerifyEmailPage = lazy(async () => {
  const module = await import("./verify-email-page");
  return { default: module.VerifyEmailPage };
});

export default function PublicVerifyEmailPage() {
  const routeContext = useAppRouteRenderContext();
  const props = routeContext.publicAuthProps;

  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading...</p>}>
      <VerifyEmailPage
        token={props.emailVerificationToken}
        isAuthenticated={false}
        onGoHome={props.onNavigateHome}
        onGoLogin={props.onNavigateLogin}
      />
    </Suspense>
  );
}