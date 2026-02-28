import { AuthenticatedSettingsContent } from "../../components/layout/authenticated-settings-content";
import { PublicAuthView } from "../../components/layout/public-auth-view";
import { useAppRouteRenderContext } from "../app-route-render-context";

function InviteFlowRouteFallback() {
  const routeContext = useAppRouteRenderContext();
  if (routeContext.isAuthenticated) {
    return <AuthenticatedSettingsContent {...routeContext.settingsProps} />;
  }
  return <PublicAuthView {...routeContext.publicAuthProps} />;
}

export function VerifyEmailRoutePage() {
  return <InviteFlowRouteFallback />;
}

export function AcceptInviteRoutePage() {
  return <InviteFlowRouteFallback />;
}