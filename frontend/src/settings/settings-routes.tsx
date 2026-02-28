import { Outlet, createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { createSettingsAdminRoutes } from "./admin/admin-routes";

const SettingsRoutePage = lazyRouteComponent(() => import("../app/route-pages/settings-route-page"), "SettingsRoutePage");

export function createSettingsRoutes(rootRoute: any) {
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: Outlet,
  });

  const settingsIndexRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "/",
    component: SettingsRoutePage,
  });

  const settingsProfileRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "/profile",
    component: SettingsRoutePage,
  });

  const settingsNotificationsRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "/notifications",
    component: SettingsRoutePage,
  });

  const settingsSecurityRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "/security",
    component: SettingsRoutePage,
  });

  const settingsGroupsRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "/groups",
    component: SettingsRoutePage,
  });

  const settingsGroupDetailRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "/group/$groupId",
    component: SettingsRoutePage,
  });

  const settingsThemeRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "/theme",
    component: SettingsRoutePage,
  });

  const settingsExtensionRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "/extensions/$extensionId",
    component: SettingsRoutePage,
  });

  const settingsAdminRoute = createSettingsAdminRoutes(settingsRoute);

  settingsRoute.addChildren([
    settingsIndexRoute,
    settingsProfileRoute,
    settingsNotificationsRoute,
    settingsSecurityRoute,
    settingsGroupsRoute,
    settingsGroupDetailRoute,
    settingsThemeRoute,
    settingsExtensionRoute,
    settingsAdminRoute,
  ]);

  return settingsRoute;
}
