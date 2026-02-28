import type { AppRouteRenderContextValue } from "../app-route-render-context";
import { setAppRouteRenderContextSnapshot } from "../app-route-render-context";

type UseAppRouteContextPublicationParams = {
  restoringSession: boolean;
  accessToken: string | null;
  authenticatedOutletContext: Omit<AppRouteRenderContextValue, "isAuthenticated">;
};

export function useAppRouteContextPublication(params: UseAppRouteContextPublicationParams) {
  if (params.restoringSession) {
    return;
  }

  const outletContext: AppRouteRenderContextValue = {
    ...params.authenticatedOutletContext,
    isAuthenticated: Boolean(params.accessToken),
  };

  setAppRouteRenderContextSnapshot(outletContext);
}