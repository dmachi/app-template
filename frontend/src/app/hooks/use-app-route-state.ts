import { useMatchRoute } from "@tanstack/react-router";
import {
  additionalBuiltInAdminSegments,
  additionalBuiltInSettingsSegments,
  resolveSelectedExtensionIdOverride,
} from "../../extensions/app-hooks/route-state";

type AppRouteState = {
  selectedGroupId: string | null;
  selectedAdminUserId: string | null;
  selectedExtensionId: string | null;
};

const BUILT_IN_ADMIN_SEGMENTS = new Set([
  "users",
  "invitations",
  "notifications",
  "roles",
  "content",
  "media",
  "content-types",
  ...(additionalBuiltInAdminSegments || []),
]);

const BUILT_IN_SETTINGS_SEGMENTS = new Set([
  "profile",
  "notifications",
  "connected-apps",
  "linked-accounts",
  "access-tokens",
  "security",
  "groups",
  "group",
  "theme",
  "admin",
  ...(additionalBuiltInSettingsSegments || []),
]);

function resolveSelectedExtensionId(
  settingsExtensionId: string | null,
  adminExtensionId: string | null,
): string | null {
  const override = resolveSelectedExtensionIdOverride(settingsExtensionId, adminExtensionId);
  if (override !== undefined) {
    return override;
  }

  return (settingsExtensionId && !BUILT_IN_SETTINGS_SEGMENTS.has(settingsExtensionId) ? settingsExtensionId : null)
    || (adminExtensionId && !BUILT_IN_ADMIN_SEGMENTS.has(adminExtensionId) ? adminExtensionId : null)
    || null;
}

export function useAppRouteState(): AppRouteState {
  const matchRoute = useMatchRoute() as (options: { to: string; fuzzy?: boolean }) => Record<string, string> | false;

  const groupDetailMatch = matchRoute({ to: "/settings/group/$groupId", fuzzy: false }) as { groupId?: string } | false;
  const selectedGroupId = groupDetailMatch && groupDetailMatch.groupId ? groupDetailMatch.groupId : null;

  const settingsExtensionMatch = matchRoute({ to: "/settings/$extensionId", fuzzy: false }) as { extensionId?: string } | false;
  const adminExtensionMatch = matchRoute({ to: "/settings/admin/$extensionId", fuzzy: false }) as { extensionId?: string } | false;
  const settingsExtensionId = settingsExtensionMatch && settingsExtensionMatch.extensionId ? settingsExtensionMatch.extensionId : null;
  const adminExtensionId = adminExtensionMatch && adminExtensionMatch.extensionId ? adminExtensionMatch.extensionId : null;
  const selectedExtensionId = resolveSelectedExtensionId(settingsExtensionId, adminExtensionId);

  const adminUserDetailMatch = matchRoute({ to: "/settings/admin/users/$userId", fuzzy: false }) as { userId?: string } | false;
  const selectedAdminUserId = adminUserDetailMatch && adminUserDetailMatch.userId ? adminUserDetailMatch.userId : null;

  return { selectedGroupId, selectedAdminUserId, selectedExtensionId };
}
