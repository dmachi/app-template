import { Outlet, createRootRouteWithContext, createRoute, createRouter, lazyRouteComponent } from "@tanstack/react-router";

import { App } from "./App";
import { appRouteRenderStore, type AppRouterContext } from "./app/app-route-render-context";
import { createSettingsRoutes } from "./settings/settings-routes";

function RootAppRoutePage() {
  return <App />;
}

const rootRoute = createRootRouteWithContext<AppRouterContext>()({
  component: RootAppRoutePage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: lazyRouteComponent(() => import("./app/route-pages/public-auth-route-pages"), "HomeRoutePage"),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: lazyRouteComponent(() => import("./app/route-pages/public-auth-route-pages"), "LoginRoutePage"),
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: lazyRouteComponent(() => import("./app/route-pages/public-auth-route-pages"), "RegisterRoutePage"),
});

const verifyEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/verify-email",
  component: lazyRouteComponent(() => import("./app/route-pages/invite-route-pages"), "VerifyEmailRoutePage"),
});

const acceptInviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/accept-invite",
  component: lazyRouteComponent(() => import("./app/route-pages/invite-route-pages"), "AcceptInviteRoutePage"),
});

const fallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$",
  component: lazyRouteComponent(() => import("./app/route-pages/public-auth-route-pages"), "HomeRoutePage"),
});

const settingsRoute = createSettingsRoutes(rootRoute);

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  verifyEmailRoute,
  acceptInviteRoute,
  fallbackRoute,
  settingsRoute,
]);

export const router = createRouter({
  routeTree,
  context: {
    appRouteRenderStore,
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
