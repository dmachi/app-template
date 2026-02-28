import { ReactNode } from "react";
import { Link, Outlet } from "@tanstack/react-router";

import { AuthenticatedAppShell } from "../components/layout/authenticated-app-shell";
import type { ClientPopupToast, RealtimeNotificationToast } from "./hooks/use-app-toast-actions";

export type AppRootPresenterBranding = {
  appName: string;
  appIconNode: ReactNode;
};

export type AppRootPresenterShell = {
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

type AppRootPresenterProps = {
  restoringSession: boolean;
  accessToken: string | null;
  branding: AppRootPresenterBranding;
  shell: AppRootPresenterShell;
};

export function AppRootPresenter(props: AppRootPresenterProps) {
  if (props.restoringSession) {
    return (
      <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        <header className="w-full border-b border-slate-200 dark:border-slate-800">
          <div className="flex w-full items-center justify-between px-6 py-3">
            <Link to="/" className="flex items-center gap-2 text-xl font-semibold">
              {props.branding.appIconNode}
              <span>{props.branding.appName}</span>
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
      appName={props.branding.appName}
      appIconNode={props.branding.appIconNode}
      currentUsername={props.shell.currentUsername}
      registrationEnabled={props.shell.registrationEnabled}
      onOpenSettings={props.shell.onOpenSettings}
      onLogout={props.shell.onLogout}
      showInviteUsers={props.shell.showInviteUsers}
      inviteDialogOpen={props.shell.inviteDialogOpen}
      onInviteDialogOpenChange={props.shell.onInviteDialogOpenChange}
      accessToken={props.accessToken}
      realtimePopups={props.shell.realtimePopups}
      clientPopups={props.shell.clientPopups}
      isActionRequiredToast={props.shell.isActionRequiredToast}
      onRemoveToast={props.shell.onRemoveToast}
      onToastManualClose={props.shell.onToastManualClose}
      onToastAcknowledge={props.shell.onToastAcknowledge}
      onToastOpenTask={props.shell.onToastOpenTask}
      onRemoveClientToast={props.shell.onRemoveClientToast}
    >
      <Outlet />
    </AuthenticatedAppShell>
  );
}