import { useAppRouteRenderContext } from "../../app/app-route-render-context";
import { SettingsLayout } from "../../layouts/settings-layout/";

export default function SettingsExtensionPage() {
  const routeContext = useAppRouteRenderContext();
  if (!routeContext.isAuthenticated) {
    return null;
  }
  return <SettingsLayout {...routeContext.settingsProps} />;
}
