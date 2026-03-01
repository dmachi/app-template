import { Outlet, Link } from "@tanstack/react-router";

import { AuthMenu } from "../../components/shared/auth-menu";
import { InviteUsersDialog } from "../../components/shared/invite-users-dialog";
import { Button } from "../../components/ui/button";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "../../components/ui/toast";
import { useAppRouteRenderContext } from "../../app/app-route-render-context";
import type { LayoutBranding, LayoutShell } from "../../lib/layouts/types";

type AppLayoutProps = {
  accessToken: string | null;
  branding: LayoutBranding;
  shell: LayoutShell;
};

function getToastClassName(severity: "info" | "success" | "warning" | "error"): string {
  if (severity === "error") {
    return "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200";
  }
  if (severity === "warning") {
    return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200";
  }
  if (severity === "success") {
    return "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200";
  }
  return "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200";
}

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

      <ToastProvider>
        {props.shell.realtimePopups.map((popup) => (
          <Toast
            key={popup.id}
            open={popup.open}
            duration={props.shell.isActionRequiredToast(popup) ? 86_400_000 : 5000}
            onOpenChange={(open) => {
              if (!open) {
                props.shell.onRemoveToast(popup.id);
              }
            }}
            className={getToastClassName(popup.severity)}
          >
            <div className="grid gap-1">
              <ToastTitle>Notification</ToastTitle>
              <ToastDescription>{popup.message}</ToastDescription>
              <div className="mt-2 flex flex-wrap gap-2">
                {popup.requiresAcknowledgement && popup.clearanceMode === "ack" ? (
                  <Button type="button" onClick={() => props.shell.onToastAcknowledge(popup.id)}>
                    Acknowledge
                  </Button>
                ) : null}
                {popup.clearanceMode === "task_gate" ? (
                  <Button type="button" onClick={() => props.shell.onToastOpenTask(popup)}>
                    Open Task
                  </Button>
                ) : null}
              </div>
            </div>
            <ToastClose aria-label="Close" onClick={() => props.shell.onToastManualClose(popup.id)} />
          </Toast>
        ))}
        {props.shell.clientPopups.map((popup) => (
          <Toast
            key={popup.id}
            open={popup.open}
            duration={4000}
            onOpenChange={(open) => {
              if (!open) {
                props.shell.onRemoveClientToast(popup.id);
              }
            }}
            className={getToastClassName(popup.severity)}
          >
            <div className="grid gap-1">
              <ToastTitle>{popup.title}</ToastTitle>
              <ToastDescription>{popup.message}</ToastDescription>
            </div>
            <ToastClose aria-label="Close" onClick={() => props.shell.onRemoveClientToast(popup.id)} />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>

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
