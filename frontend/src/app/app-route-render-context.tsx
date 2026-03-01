import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";

import type { SettingsLayoutProps } from "../layouts/settings-layout/";
import type { PublicRouteProps } from "../pages/public-route-props";

export type AppRouteRenderContextValue = {
  isAuthenticated: boolean;
  publicAuthProps: PublicRouteProps;
  settingsProps: SettingsLayoutProps;
};

export type AppRouteRenderStore = {
  getSnapshot: () => AppRouteRenderContextValue | null;
  subscribe: (listener: () => void) => () => void;
};

export type AppRouterContext = {
  appRouteRenderStore: AppRouteRenderStore;
};

let currentSnapshot: AppRouteRenderContextValue | null = null;
const listeners = new Set<() => void>();

export const appRouteRenderStore: AppRouteRenderStore = {
  getSnapshot: () => currentSnapshot,
  subscribe: (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function setAppRouteRenderContextSnapshot(nextSnapshot: AppRouteRenderContextValue, options?: { notify?: boolean }) {
  currentSnapshot = nextSnapshot;
  if (options?.notify === false) {
    return;
  }
  for (const listener of listeners) {
    listener();
  }
}

export function useAppRouteRenderContext(): AppRouteRenderContextValue {
  const routeContext = useRouteContext({ from: rootRouteId, select: (context) => context as AppRouterContext });
  const snapshot = useSyncExternalStore(routeContext.appRouteRenderStore.subscribe, routeContext.appRouteRenderStore.getSnapshot, routeContext.appRouteRenderStore.getSnapshot);
  if (!snapshot) {
    throw new Error("App route render context snapshot is not initialized");
  }
  return snapshot;
}
