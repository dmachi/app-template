import { Outlet, createRoute } from "@tanstack/react-router";
import { lazy } from "react";

import { createLayoutRoute } from "../lib/layouts/create-layout-route";
import { createSettingsAdminRoutes } from "./admin/admin-routes";

const SettingsIndexPage = lazy(() => import("./pages/profile-page"));
const SettingsProfilePage = lazy(() => import("./pages/profile-page"));
const SettingsNotificationsPage = lazy(() => import("./pages/notifications-page"));
const SettingsSecurityPage = lazy(() => import("./pages/security-page"));
const SettingsGroupsPage = lazy(() => import("./pages/groups-page"));
const SettingsGroupDetailPage = lazy(() => import("./pages/group-detail-page"));
const SettingsThemePage = lazy(() => import("./pages/theme-page"));
const SettingsExtensionPage = lazy(() => import("./pages/settings-extension-page"));

export function createSettingsRoutes(rootRoute: any) {
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: Outlet,
  });

  const settingsIndexRoute = createLayoutRoute({
    getParentRoute: () => settingsRoute,
    path: "/",
    layout: "settings-layout",
    component: SettingsIndexPage,
  });

  const settingsProfileRoute = createLayoutRoute({
    getParentRoute: () => settingsRoute,
    path: "/profile",
    layout: "settings-layout",
    component: SettingsProfilePage,
  });

  const settingsNotificationsRoute = createLayoutRoute({
    getParentRoute: () => settingsRoute,
    path: "/notifications",
    layout: "settings-layout",
    component: SettingsNotificationsPage,
  });

  const settingsSecurityRoute = createLayoutRoute({
    getParentRoute: () => settingsRoute,
    path: "/security",
    layout: "settings-layout",
    component: SettingsSecurityPage,
  });

  const settingsGroupsRoute = createLayoutRoute({
    getParentRoute: () => settingsRoute,
    path: "/groups",
    layout: "settings-layout",
    component: SettingsGroupsPage,
  });

  const settingsGroupDetailRoute = createLayoutRoute({
    getParentRoute: () => settingsRoute,
    path: "/group/$groupId",
    layout: "settings-layout",
    component: SettingsGroupDetailPage,
  });

  const settingsThemeRoute = createLayoutRoute({
    getParentRoute: () => settingsRoute,
    path: "/theme",
    layout: "settings-layout",
    component: SettingsThemePage,
  });

//   const settingsExtensionRoute = createLayoutRoute({
//     getParentRoute: () => settingsRoute,
//     path: "/extensions/$extensionId",
//     layout: "settings-layout",
//     component: SettingsExtensionPage,
//   });

  const settingsAdminRoute = createSettingsAdminRoutes(settingsRoute);

  settingsRoute.addChildren([
    settingsIndexRoute,
    settingsProfileRoute,
    settingsNotificationsRoute,
    settingsSecurityRoute,
    settingsGroupsRoute,
    settingsGroupDetailRoute,
    settingsThemeRoute,
    // settingsExtensionRoute,
    settingsAdminRoute,
  ]);

  return settingsRoute;
}
