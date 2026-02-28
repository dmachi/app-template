import { Outlet, createRoute, lazyRouteComponent } from "@tanstack/react-router";

const SettingsRoutePage = lazyRouteComponent(() => import("../../app/route-pages/settings-route-page"), "SettingsRoutePage");

export function createSettingsAdminRoutes(settingsRoute: any) {
  const settingsAdminRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "/admin",
    component: Outlet,
  });

  const settingsAdminIndexRoute = createRoute({
    getParentRoute: () => settingsAdminRoute,
    path: "/",
    component: SettingsRoutePage,
  });

  const settingsAdminUsersRoute = createRoute({
    getParentRoute: () => settingsAdminRoute,
    path: "/users",
    component: SettingsRoutePage,
  });

  const settingsAdminUserDetailRoute = createRoute({
    getParentRoute: () => settingsAdminRoute,
    path: "/users/$userId",
    component: SettingsRoutePage,
  });

  const settingsAdminInvitationsRoute = createRoute({
    getParentRoute: () => settingsAdminRoute,
    path: "/invitations",
    component: SettingsRoutePage,
  });

  const settingsAdminNotificationsRoute = createRoute({
    getParentRoute: () => settingsAdminRoute,
    path: "/notifications",
    component: SettingsRoutePage,
  });

  const settingsAdminRolesRoute = createRoute({
    getParentRoute: () => settingsAdminRoute,
    path: "/roles",
    component: SettingsRoutePage,
  });

  settingsAdminRoute.addChildren([
    settingsAdminIndexRoute,
    settingsAdminUsersRoute,
    settingsAdminUserDetailRoute,
    settingsAdminInvitationsRoute,
    settingsAdminNotificationsRoute,
    settingsAdminRolesRoute,
  ]);

  return settingsAdminRoute;
}
