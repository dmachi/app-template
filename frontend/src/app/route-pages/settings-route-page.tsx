import { AuthenticatedSettingsContent } from "../../components/layout/authenticated-settings-content";
import { useAppRouteRenderContext } from "../app-route-render-context";

export function SettingsRoutePage() {
  const routeContext = useAppRouteRenderContext();
  if (!routeContext.isAuthenticated) {
    return null;
  }
  return <AuthenticatedSettingsContent {...routeContext.settingsProps} />;
}