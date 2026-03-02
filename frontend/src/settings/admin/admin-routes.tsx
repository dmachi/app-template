import { Outlet, createRoute } from "@tanstack/react-router";
import { lazy } from "react";

import { createLayoutRoute } from "../../lib/layouts/create-layout-route";

type RouteLayoutOption = string | "none" | [string, Record<string, unknown>];

const AdminIndexPage = lazy(() => import("./pages/admin-users-page"));
const AdminUsersPage = lazy(() => import("./pages/admin-users-page"));
const AdminUserDetailPage = lazy(() => import("./pages/admin-user-detail-page"));
const AdminInvitationsPage = lazy(() => import("./pages/admin-invitations-page"));
const AdminNotificationsPage = lazy(() => import("./pages/admin-notifications-page"));
const AdminRolesPage = lazy(() => import("./pages/admin-roles-page"));
const AdminContentPage = lazy(() => import("./pages/admin-content-page"));
const AdminContentEditorPage = lazy(() => import("./pages/admin-content-editor-page"));
const AdminContentTypesPage = lazy(() => import("./pages/admin-content-types-page"));
const AdminContentTypeDetailPage = lazy(() => import("./pages/admin-content-type-detail-page"));
const AdminMediaPage = lazy(() => import("./pages/admin-media-page"));

export function createSettingsAdminRoutes(settingsRoute: any, layout: RouteLayoutOption = "none") {
  const settingsAdminRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: "/admin",
    component: Outlet,
  });

  const settingsAdminIndexRoute = createLayoutRoute({
    getParentRoute: () => settingsAdminRoute,
    path: "/",
    layout,
    component: AdminIndexPage,
  });

  const settingsAdminUsersRoute = createLayoutRoute({
    getParentRoute: () => settingsAdminRoute,
    path: "/users",
    layout,
    component: AdminUsersPage,
  });

  const settingsAdminUserDetailRoute = createLayoutRoute({
    getParentRoute: () => settingsAdminRoute,
    path: "/users/$userId",
    layout,
    component: AdminUserDetailPage,
  });

  const settingsAdminInvitationsRoute = createLayoutRoute({
    getParentRoute: () => settingsAdminRoute,
    path: "/invitations",
    layout,
    component: AdminInvitationsPage,
  });

  const settingsAdminNotificationsRoute = createLayoutRoute({
    getParentRoute: () => settingsAdminRoute,
    path: "/notifications",
    layout,
    component: AdminNotificationsPage,
  });

  const settingsAdminRolesRoute = createLayoutRoute({
    getParentRoute: () => settingsAdminRoute,
    path: "/roles",
    layout,
    component: AdminRolesPage,
  });

  const settingsAdminContentRoute = createLayoutRoute({
    getParentRoute: () => settingsAdminRoute,
    path: "/content",
    layout,
    component: AdminContentPage,
  });

  const settingsAdminContentEditorRoute = createLayoutRoute({
    getParentRoute: () => settingsAdminRoute,
    path: "/content/$contentId",
    layout,
    component: AdminContentEditorPage,
  });

  const settingsAdminContentTypesRoute = createLayoutRoute({
    getParentRoute: () => settingsAdminRoute,
    path: "/content-types",
    layout,
    component: AdminContentTypesPage,
  });

  const settingsAdminContentTypeDetailRoute = createLayoutRoute({
    getParentRoute: () => settingsAdminRoute,
    path: "/content-types/$contentTypeKey",
    layout,
    component: AdminContentTypeDetailPage,
  });

  const settingsAdminMediaRoute = createLayoutRoute({
    getParentRoute: () => settingsAdminRoute,
    path: "/media",
    layout,
    component: AdminMediaPage,
  });

  settingsAdminRoute.addChildren([
    settingsAdminIndexRoute,
    settingsAdminUsersRoute,
    settingsAdminUserDetailRoute,
    settingsAdminInvitationsRoute,
    settingsAdminNotificationsRoute,
    settingsAdminRolesRoute,
    settingsAdminContentRoute,
    settingsAdminContentEditorRoute,
    settingsAdminContentTypesRoute,
    settingsAdminContentTypeDetailRoute,
    settingsAdminMediaRoute,
  ]);

  return settingsAdminRoute;
}
