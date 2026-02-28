import { AuthenticatedHomeContent } from "../../components/layout/authenticated-home-content";
import { PublicAuthView } from "../../components/layout/public-auth-view";
import { useAppRouteRenderContext } from "../app-route-render-context";

function PublicAuthRouteFallback() {
  const routeContext = useAppRouteRenderContext();
  if (routeContext.isAuthenticated) {
    return <AuthenticatedHomeContent {...routeContext.homeProps} />;
  }
  return <PublicAuthView {...routeContext.publicAuthProps} />;
}

export function HomeRoutePage() {
  return <PublicAuthRouteFallback />;
}

export function LoginRoutePage() {
  return <PublicAuthRouteFallback />;
}

export function RegisterRoutePage() {
  return <PublicAuthRouteFallback />;
}