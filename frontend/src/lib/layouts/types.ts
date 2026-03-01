import type { ReactNode } from "react";

import type { ClientPopupToast, RealtimeNotificationToast } from "../../app/hooks/use-app-toast-actions";

export type LayoutId = "public-route" | "authenticated-shell";

export type LayoutBranding = {
  appName: string;
  appIconNode: ReactNode;
};

export type LayoutShell = {
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

export type LayoutRenderContext = {
  restoringSession: boolean;
  accessToken: string | null;
  branding: LayoutBranding;
  shell: LayoutShell;
};
