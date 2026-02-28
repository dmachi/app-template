import { Outlet, createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";

import { App } from "./App";
import { appRouteRenderStore, type AppRouterContext } from "./app/app-route-render-context";
import { AcceptInviteRoutePage, HomeRoutePage, LoginRoutePage, RegisterRoutePage, VerifyEmailRoutePage } from "./app/route-pages";
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
  component: HomeRoutePage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginRoutePage,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: RegisterRoutePage,
});

const verifyEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/verify-email",
  component: VerifyEmailRoutePage,
});

const acceptInviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/accept-invite",
  component: AcceptInviteRoutePage,
});

const fallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$",
  component: HomeRoutePage,
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
