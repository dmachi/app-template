import { createRootRouteWithContext, createRouter } from "@tanstack/react-router";
import { lazy } from "react";

import { App } from "./App";
import { appRouteRenderStore, type AppRouterContext } from "./app/app-route-render-context";
import { createLayoutRoute } from "./lib/layouts/create-layout-route";
import { createSettingsRoutes } from "./settings/settings-routes";

const HomePage = lazy(() => import("./pages/home-page"));
const LoginPage = lazy(() => import("./pages/login-page"));
const RegisterPage = lazy(() => import("./pages/register-page"));
const PublicVerifyEmailPage = lazy(() => import("./pages/public-verify-email-page"));
const PublicAcceptInvitePage = lazy(() => import("./pages/public-accept-invite-page"));

function RootAppRoutePage() {
  return <App />;
}

const rootRoute = createRootRouteWithContext<AppRouterContext>()({
  component: RootAppRoutePage,
});

const indexRoute = createLayoutRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  layout: "simple-layout",
  component: HomePage,
});

const loginRoute = createLayoutRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  layout: "simple-layout",
  component: LoginPage,
});

const registerRoute = createLayoutRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  layout: "simple-layout",
  component: RegisterPage,
});

const verifyEmailRoute = createLayoutRoute({
  getParentRoute: () => rootRoute,
  path: "/verify-email",
  layout: "simple-layout",
  component: PublicVerifyEmailPage,
});

const acceptInviteRoute = createLayoutRoute({
  getParentRoute: () => rootRoute,
  path: "/accept-invite",
  layout: "simple-layout",
  component: PublicAcceptInvitePage,
});

const fallbackRoute = createLayoutRoute({
  getParentRoute: () => rootRoute,
  path: "/$",
  layout: "simple-layout",
  component: HomePage,
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
