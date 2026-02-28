import { AuthenticatedHomeContent } from "../components/layout/authenticated-home-content";
import { AuthenticatedSettingsContent } from "../components/layout/authenticated-settings-content";
import { PublicAuthView } from "../components/layout/public-auth-view";
import { useAppRouteRenderContext } from "./app-route-render-context";

export function HomeRoutePage() {
  const routeContext = useAppRouteRenderContext();
  if (routeContext.isAuthenticated) {
    return <AuthenticatedHomeContent {...routeContext.homeProps} />;
  }
  return <PublicAuthView {...routeContext.publicAuthProps} />;
}

export function LoginRoutePage() {
  const routeContext = useAppRouteRenderContext();
  if (routeContext.isAuthenticated) {
    return <AuthenticatedHomeContent {...routeContext.homeProps} />;
  }
  return <PublicAuthView {...routeContext.publicAuthProps} />;
}

export function RegisterRoutePage() {
  const routeContext = useAppRouteRenderContext();
  if (routeContext.isAuthenticated) {
    return <AuthenticatedHomeContent {...routeContext.homeProps} />;
  }
  return <PublicAuthView {...routeContext.publicAuthProps} />;
}

export function VerifyEmailRoutePage() {
  const routeContext = useAppRouteRenderContext();
  if (routeContext.isAuthenticated) {
    return <AuthenticatedSettingsContent {...routeContext.settingsProps} />;
  }
  return <PublicAuthView {...routeContext.publicAuthProps} />;
}

export function AcceptInviteRoutePage() {
  const routeContext = useAppRouteRenderContext();
  if (routeContext.isAuthenticated) {
    return <AuthenticatedSettingsContent {...routeContext.settingsProps} />;
  }
  return <PublicAuthView {...routeContext.publicAuthProps} />;
}

export function SettingsRoutePage() {
  const routeContext = useAppRouteRenderContext();
  if (!routeContext.isAuthenticated) {
    return null;
  }
  return <AuthenticatedSettingsContent {...routeContext.settingsProps} />;
}
