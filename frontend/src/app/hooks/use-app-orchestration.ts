import { Dispatch, SetStateAction } from "react";

import type { NotificationItem } from "../../lib/api";
import { useProfileAndAdminBootstrap } from "./use-app-bootstrap";
import { useAutoAcceptInvitation, usePendingInvitationTokenSync } from "./use-app-invitations";
import { useRealtimeNotifications, useRouteGuards } from "./use-app-runtime";
import type { RealtimeNotificationToast } from "./use-app-toast-actions";

type UseAppOrchestrationParams = {
  accessToken: string | null;
  isAcceptInviteRoute: boolean;
  tokenParam: string | null;
  inviteTokenParam: string | null;
  inviteTokenStorageKey: string;
  setPendingInvitationToken: Dispatch<SetStateAction<string | null>>;
  setCurrentUsername: Dispatch<SetStateAction<string>>;
  setTheme: Dispatch<SetStateAction<"light" | "dark" | "system">>;
  setCanAccessAdmin: Dispatch<SetStateAction<boolean | null>>;
  setAdminAccessChecked: Dispatch<SetStateAction<boolean>>;
  setAdminCapabilities: Dispatch<SetStateAction<{ users: boolean; groups: boolean; invitations: boolean; roles: boolean }>>;
  pendingInvitationToken: string | null;
  acceptingInvitation: boolean;
  locationPathname: string;
  setAcceptingInvitation: Dispatch<SetStateAction<boolean>>;
  setInvitationAcceptanceMessage: Dispatch<SetStateAction<string | null>>;
  navigateHomeReplace: () => void;
  apiBase: string;
  refreshHomeNotifications: (token: string) => Promise<void>;
  setRealtimePopups: Dispatch<SetStateAction<RealtimeNotificationToast[]>>;
  setHomeNotifications: Dispatch<SetStateAction<NotificationItem[]>>;
  setNotificationRefreshSignal: Dispatch<SetStateAction<number>>;
  restoringSession: boolean;
  canAccessAdmin: boolean | null;
  adminAccessChecked: boolean;
  adminCapabilities: { users: boolean; groups: boolean; invitations: boolean; roles: boolean };
  selectedGroupId: string | null;
  selectedExtensionId: string | null;
  navigateTo: (to: string, replace?: boolean) => void;
};

export function useAppOrchestration(params: UseAppOrchestrationParams) {
  usePendingInvitationTokenSync({
    isAcceptInviteRoute: params.isAcceptInviteRoute,
    tokenParam: params.tokenParam,
    inviteTokenParam: params.inviteTokenParam,
    inviteTokenStorageKey: params.inviteTokenStorageKey,
    setPendingInvitationToken: params.setPendingInvitationToken,
  });

  useProfileAndAdminBootstrap({
    accessToken: params.accessToken,
    setCurrentUsername: params.setCurrentUsername,
    setTheme: params.setTheme,
    setCanAccessAdmin: params.setCanAccessAdmin,
    setAdminAccessChecked: params.setAdminAccessChecked,
    setAdminCapabilities: params.setAdminCapabilities,
  });

  useAutoAcceptInvitation({
    accessToken: params.accessToken,
    pendingInvitationToken: params.pendingInvitationToken,
    acceptingInvitation: params.acceptingInvitation,
    locationPathname: params.locationPathname,
    inviteTokenStorageKey: params.inviteTokenStorageKey,
    setAcceptingInvitation: params.setAcceptingInvitation,
    setInvitationAcceptanceMessage: params.setInvitationAcceptanceMessage,
    setPendingInvitationToken: params.setPendingInvitationToken,
    navigateHomeReplace: params.navigateHomeReplace,
  });

  useRealtimeNotifications({
    accessToken: params.accessToken,
    locationPathname: params.locationPathname,
    apiBase: params.apiBase,
    refreshHomeNotifications: params.refreshHomeNotifications,
    setRealtimePopups: params.setRealtimePopups,
    setHomeNotifications: params.setHomeNotifications,
    setNotificationRefreshSignal: params.setNotificationRefreshSignal,
  });

  useRouteGuards({
    restoringSession: params.restoringSession,
    accessToken: params.accessToken,
    canAccessAdmin: params.canAccessAdmin,
    adminAccessChecked: params.adminAccessChecked,
    adminCapabilities: params.adminCapabilities,
    locationPathname: params.locationPathname,
    selectedGroupId: params.selectedGroupId,
    selectedExtensionId: params.selectedExtensionId,
    navigateTo: params.navigateTo,
  });
}