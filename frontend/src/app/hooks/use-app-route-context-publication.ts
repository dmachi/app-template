import { useEffect } from "react";

import type { AppRouteRenderContextValue } from "../app-route-render-context";
import { setAppRouteRenderContextSnapshot } from "../app-route-render-context";

type UseAppRouteContextPublicationParams = {
  restoringSession: boolean;
  accessToken: string | null;
  authenticatedOutletContext: Omit<AppRouteRenderContextValue, "isAuthenticated">;
};

export function useAppRouteContextPublication(params: UseAppRouteContextPublicationParams) {
  const outletContext: AppRouteRenderContextValue | null = params.restoringSession
    ? null
    : {
      ...params.authenticatedOutletContext,
      isAuthenticated: Boolean(params.accessToken),
    };

  if (outletContext) {
    setAppRouteRenderContextSnapshot(outletContext, { notify: false });
  }

  useEffect(() => {
    if (!outletContext) {
      return;
    }
    setAppRouteRenderContextSnapshot(outletContext);
  }, [outletContext]);
}