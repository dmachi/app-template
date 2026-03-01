import { Suspense, lazy } from "react";

import { useAppRouteRenderContext } from "../app/app-route-render-context";

const AcceptInvitePage = lazy(async () => {
  const module = await import("./accept-invite-page");
  return { default: module.AcceptInvitePage };
});

export default function PublicAcceptInvitePage() {
  const routeContext = useAppRouteRenderContext();
  const props = routeContext.publicAuthProps;

  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading...</p>}>
      <AcceptInvitePage
        token={props.invitationToken}
        registrationEnabled={props.registrationEnabled}
        authProviders={props.authProviders}
        isAuthenticated={false}
        acceptanceMessage={props.invitationAcceptanceMessage}
        accepting={props.acceptingInvitation}
        onLogin={() => props.onNavigateToAuthWithInvite("login")}
        onRegister={() => props.onNavigateToAuthWithInvite("register")}
        onProviderStart={props.onProviderStart}
        onGoHome={props.onNavigateHome}
      />
    </Suspense>
  );
}