import { Outlet, createRoute } from "@tanstack/react-router";
import { lazy } from "react";

import { createSettingsNavigationMenuConfig } from "../config/settings-navigation-menu";
import { getAdditionalAdminItems, getSettingsExtensions } from "../extensions/settings-registry";
import { createLayoutRoute } from "../lib/layouts/create-layout-route";
import { createSettingsAdminRoutes } from "./admin/admin-routes";
import {
  buildSettingsExtensionNavigationItems,
  DEFAULT_SETTINGS_NAVIGATION_CONTEXT,
} from "./settings-extension-navigation";

const SettingsIndexPage = lazy(() => import("./pages/profile-page"));
const SettingsProfilePage = lazy(() => import("./pages/profile-page"));
const SettingsNotificationsPage = lazy(() => import("./pages/notifications-page"));
const SettingsConnectedAppsPage = lazy(() => import("./pages/connected-apps-page"));
const SettingsLinkedAccountsPage = lazy(() => import("./pages/linked-accounts-page"));
const SettingsAccessTokensPage = lazy(() => import("./pages/access-tokens-page"));
const SettingsSecurityPage = lazy(() => import("./pages/security-page"));
const SettingsGroupsPage = lazy(() => import("./pages/groups-page"));
const SettingsGroupDetailPage = lazy(() => import("./pages/group-detail-page"));
const SettingsThemePage = lazy(() => import("./pages/theme-page"));
const SettingsExtensionPage = lazy(() => import("./pages/settings-extension-page"));

const extensionItems = getSettingsExtensions(DEFAULT_SETTINGS_NAVIGATION_CONTEXT);
const extensionAdditionalAdminItems = getAdditionalAdminItems(DEFAULT_SETTINGS_NAVIGATION_CONTEXT);

const extensionNavigationItems = buildSettingsExtensionNavigationItems({
  extensionItems,
  additionalAdminItems: extensionAdditionalAdminItems,
});

const settingsNavigationConfig = createSettingsNavigationMenuConfig(extensionNavigationItems);

const settingsSidebarLevels = [
  {
    id: "full",
    minViewportWidth: 1000,
    widthClassName: "w-56",
    iconMode: false,
  },
  {
    id: "mini",
    minViewportWidth: 600,
    widthClassName: "w-14",
    iconMode: true,
  },
];

const settingsLayoutOption: [string, Record<string, unknown>] = [
  "navigation-sidebar-layout",
  {
    navigationConfig: settingsNavigationConfig,
    resizableLevels: settingsSidebarLevels,
  },
];

export function createSettingsRoutes(rootRoute: any) {
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: Outlet,
  });

  const settingsIndexRoute = createLayoutRoute({
    getParentRoute: () => settingsRoute,
    path: "/",
    layout: settingsLayoutOption,
    component: SettingsIndexPage,
  });

  const settingsProfileRoute = createLayoutRoute({
    getParentRoute: () => settingsRoute,
    path: "/profile",
    layout: settingsLayoutOption,
    component: SettingsProfilePage,
  });

  const settingsNotificationsRoute = createLayoutRoute({
    getParentRoute: () => settingsRoute,
    path: "/notifications",
    layout: settingsLayoutOption,
    component: SettingsNotificationsPage,
  });

  const settingsConnectedAppsRoute = createLayoutRoute({
    getParentRoute: () => settingsRoute,
    path: "/connected-apps",
    layout: settingsLayoutOption,
    component: SettingsConnectedAppsPage,
  });

  const settingsLinkedAccountsRoute = createLayoutRoute({
    getParentRoute: () => settingsRoute,
    path: "/linked-accounts",
    layout: settingsLayoutOption,
    component: SettingsLinkedAccountsPage,
  });

  const settingsSecurityRoute = createLayoutRoute({
    getParentRoute: () => settingsRoute,
    path: "/security",
    layout: settingsLayoutOption,
    component: SettingsSecurityPage,
  });

  const settingsAccessTokensRoute = createLayoutRoute({
    getParentRoute: () => settingsRoute,
    path: "/access-tokens",
    layout: settingsLayoutOption,
    component: SettingsAccessTokensPage,
  });

  const settingsGroupsRoute = createLayoutRoute({
    getParentRoute: () => settingsRoute,
    path: "/groups",
    layout: settingsLayoutOption,
    component: SettingsGroupsPage,
  });

  const settingsGroupDetailRoute = createLayoutRoute({
    getParentRoute: () => settingsRoute,
    path: "/group/$groupId",
    layout: settingsLayoutOption,
    component: SettingsGroupDetailPage,
  });

  const settingsThemeRoute = createLayoutRoute({
    getParentRoute: () => settingsRoute,
    path: "/theme",
    layout: settingsLayoutOption,
    component: SettingsThemePage,
  });

  const settingsExtensionRoute = createLayoutRoute({
    getParentRoute: () => settingsRoute,
    path: "/$extensionId",
    layout: settingsLayoutOption,
    component: SettingsExtensionPage,
  });

  const settingsAdminExtensionRoute = createLayoutRoute({
    getParentRoute: () => settingsRoute,
    path: "/admin/$extensionId",
    layout: settingsLayoutOption,
    component: SettingsExtensionPage,
  });

  const settingsAdminRoute = createSettingsAdminRoutes(settingsRoute, settingsLayoutOption);

  settingsRoute.addChildren([
    settingsIndexRoute,
    settingsProfileRoute,
    settingsNotificationsRoute,
    settingsConnectedAppsRoute,
    settingsLinkedAccountsRoute,
    settingsAccessTokensRoute,
    settingsSecurityRoute,
    settingsGroupsRoute,
    settingsGroupDetailRoute,
    settingsThemeRoute,
    settingsExtensionRoute,
    settingsAdminExtensionRoute,
    settingsAdminRoute,
  ]);

  return settingsRoute;
}
