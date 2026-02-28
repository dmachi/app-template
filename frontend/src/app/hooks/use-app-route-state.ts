import { useMatchRoute } from "@tanstack/react-router";

type AppRouteState = {
  selectedGroupId: string | null;
  selectedAdminUserId: string | null;
  selectedExtensionId: string | null;
};

export function useAppRouteState(): AppRouteState {
  const matchRoute = useMatchRoute() as (options: { to: string; fuzzy?: boolean }) => Record<string, string> | false;

  const groupDetailMatch = matchRoute({ to: "/settings/group/$groupId", fuzzy: false }) as { groupId?: string } | false;
  const selectedGroupId = groupDetailMatch && groupDetailMatch.groupId ? groupDetailMatch.groupId : null;

  const extensionMatch = matchRoute({ to: "/settings/extensions/$extensionId", fuzzy: false }) as { extensionId?: string } | false;
  const selectedExtensionId = extensionMatch && extensionMatch.extensionId ? extensionMatch.extensionId : null;

  const adminUserDetailMatch = matchRoute({ to: "/settings/admin/users/$userId", fuzzy: false }) as { userId?: string } | false;
  const selectedAdminUserId = adminUserDetailMatch && adminUserDetailMatch.userId ? adminUserDetailMatch.userId : null;

  return { selectedGroupId, selectedAdminUserId, selectedExtensionId };
}
