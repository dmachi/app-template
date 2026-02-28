import { ReactNode } from "react";
import { Link, Outlet } from "@tanstack/react-router";

import { AuthenticatedAppShell } from "../components/layout/authenticated-app-shell";
import type { ClientPopupToast, RealtimeNotificationToast } from "./hooks/use-app-toast-actions";

type AppRootPresenterProps = {
  restoringSession: boolean;
  appName: string;
  appIconNode: ReactNode;
  accessToken: string | null;
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

export function AppRootPresenter(props: AppRootPresenterProps) {
  if (props.restoringSession) {
    return (
      <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        <header className="w-full border-b border-slate-200 dark:border-slate-800">
          <div className="flex w-full items-center justify-between px-6 py-3">
            <Link to="/" className="flex items-center gap-2 text-xl font-semibold">
              {props.appIconNode}
              <span>{props.appName}</span>
            </Link>
          </div>
        </header>
        <main className="mx-auto grid w-full max-w-xl gap-3 px-4 py-6">
          <p className="text-sm">Restoring session...</p>
        </main>
      </div>
    );
  }

  if (!props.accessToken) {
    return <Outlet />;
  }

  return (
    <AuthenticatedAppShell
      appName={props.appName}
      appIconNode={props.appIconNode}
      currentUsername={props.currentUsername}
      registrationEnabled={props.registrationEnabled}
      onOpenSettings={props.onOpenSettings}
      onLogout={props.onLogout}
      showInviteUsers={props.showInviteUsers}
      inviteDialogOpen={props.inviteDialogOpen}
      onInviteDialogOpenChange={props.onInviteDialogOpenChange}
      accessToken={props.accessToken}
      realtimePopups={props.realtimePopups}
      clientPopups={props.clientPopups}
      isActionRequiredToast={props.isActionRequiredToast}
      onRemoveToast={props.onRemoveToast}
      onToastManualClose={props.onToastManualClose}
      onToastAcknowledge={props.onToastAcknowledge}
      onToastOpenTask={props.onToastOpenTask}
      onRemoveClientToast={props.onRemoveClientToast}
    >
      <Outlet />
    </AuthenticatedAppShell>
  );
}