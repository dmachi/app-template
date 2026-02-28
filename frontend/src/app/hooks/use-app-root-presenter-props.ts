import type { ReactNode } from "react";

import type { AppRootPresenterBranding, AppRootPresenterShell } from "../app-root-presenter";
import type { ClientPopupToast, RealtimeNotificationToast } from "./use-app-toast-actions";

type UseAppRootPresenterPropsParams = {
  appName: string;
  appIconNode: ReactNode;
  currentUsername: string;
  registrationEnabled: boolean;
  onOpenSettings: () => void;
  onLogout: () => void;
  showInviteUsers: boolean;
  inviteDialogOpen: boolean;
  onInviteDialogOpenChange: (open: boolean) => void;
  realtimePopups: RealtimeNotificationToast[];
  clientPopups: ClientPopupToast[];
  isActionRequiredToast: (toast: RealtimeNotificationToast) => boolean;
  onRemoveToast: (toastId: string) => void;
  onToastManualClose: (toastId: string) => void;
  onToastAcknowledge: (toastId: string) => void;
  onToastOpenTask: (toast: RealtimeNotificationToast) => void;
  onRemoveClientToast: (toastId: string) => void;
};

export function useAppRootPresenterProps(params: UseAppRootPresenterPropsParams): {
  branding: AppRootPresenterBranding;
  shell: AppRootPresenterShell;
} {
  const branding: AppRootPresenterBranding = {
    appName: params.appName,
    appIconNode: params.appIconNode,
  };

  const shell: AppRootPresenterShell = {
    currentUsername: params.currentUsername,
    registrationEnabled: params.registrationEnabled,
    onOpenSettings: params.onOpenSettings,
    onLogout: params.onLogout,
    showInviteUsers: params.showInviteUsers,
    inviteDialogOpen: params.inviteDialogOpen,
    onInviteDialogOpenChange: params.onInviteDialogOpenChange,
    realtimePopups: params.realtimePopups,
    clientPopups: params.clientPopups,
    isActionRequiredToast: params.isActionRequiredToast,
    onRemoveToast: params.onRemoveToast,
    onToastManualClose: params.onToastManualClose,
    onToastAcknowledge: params.onToastAcknowledge,
    onToastOpenTask: params.onToastOpenTask,
    onRemoveClientToast: params.onRemoveClientToast,
  };

  return {
    branding,
    shell,
  };
}