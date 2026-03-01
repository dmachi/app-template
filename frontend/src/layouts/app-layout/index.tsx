import { Outlet, Link } from "@tanstack/react-router";

import { AppNotificationToasts } from "../../components/app-notification-toasts";
import { AuthMenu } from "../../components/auth-menu";
import { InviteUsersDialog } from "../../components/invite-users-dialog";
import { useAppRouteRenderContext } from "../../app/app-route-render-context";
import type { LayoutBranding, LayoutShell } from "../../lib/layouts/types";

type AppLayoutProps = {
  accessToken: string | null;
  branding: LayoutBranding;
  shell: LayoutShell;
};

export function AppLayout(props: AppLayoutProps) {
  const routeContext = useAppRouteRenderContext();
  const isAuthenticated = routeContext.isAuthenticated;

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <header className="w-full border-b border-slate-200 dark:border-slate-800">
        <div className="flex w-full items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2 text-xl font-semibold">
            {props.branding.appIconNode}
            <span>{props.branding.appName}</span>
          </Link>
          <AuthMenu
            isAuthenticated={isAuthenticated}
            currentUserName={props.shell.currentUsername}
            registrationEnabled={props.shell.registrationEnabled}
            onLogin={routeContext.publicAuthProps.onNavigateLogin}
            onRegister={routeContext.publicAuthProps.onNavigateRegister}
            onSettings={props.shell.onOpenSettings}
            onLogout={props.shell.onLogout}
            extraMenuItems={props.shell.showInviteUsers ? [{ label: "Invite Users", onSelect: () => props.shell.onInviteDialogOpenChange(true) }] : []}
          />
        </div>
      </header>

      <AppNotificationToasts
        realtimePopups={props.shell.realtimePopups}
        clientPopups={props.shell.clientPopups}
        isActionRequiredToast={props.shell.isActionRequiredToast}
        onRemoveToast={props.shell.onRemoveToast}
        onToastManualClose={props.shell.onToastManualClose}
        onToastAcknowledge={props.shell.onToastAcknowledge}
        onToastOpenTask={props.shell.onToastOpenTask}
        onRemoveClientToast={props.shell.onRemoveClientToast}
      />

      {isAuthenticated && props.shell.showInviteUsers && props.accessToken ? (
        <InviteUsersDialog
          accessToken={props.accessToken}
          open={props.shell.inviteDialogOpen}
          onOpenChange={props.shell.onInviteDialogOpenChange}
          hideTrigger
        />
      ) : null}

      <Outlet />
    </div>
  );
}
