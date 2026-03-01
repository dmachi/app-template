import { useAppRouteRenderContext } from "../../app/app-route-render-context";
import { getSettingsExtensions } from "../../extensions/settings-registry";

export default function SettingsExtensionPage() {
  const routeContext = useAppRouteRenderContext();
  if (!routeContext.isAuthenticated) {
    return null;
  }

  const settingsExtensions = getSettingsExtensions({
    canAccessAdmin: routeContext.settingsProps.canAccessAdmin,
    adminCapabilities: routeContext.settingsProps.adminCapabilities,
  });

  const activeExtension = routeContext.settingsProps.selectedExtensionId
    ? settingsExtensions.find((item) => item.id === routeContext.settingsProps.selectedExtensionId)
    : null;

  if (!activeExtension) {
    return null;
  }

  return activeExtension.render({ accessToken: routeContext.settingsProps.accessToken });
}
