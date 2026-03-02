import { Outlet } from "@tanstack/react-router";

import { useAppRouteRenderContext } from "../../app/app-route-render-context";
import { AppHeader } from "../../components/app-header";
import { AppNotificationToasts } from "../../components/app-notification-toasts";
import { InviteUsersDialog } from "../../components/invite-users-dialog";
import { createAppHeaderNavigationMenuConfig } from "../../config/app-header-menu";
import { resolveAppHeaderPathVariant } from "../../config/app-header-variants";
import type { LayoutBranding, LayoutShell } from "../../lib/layouts/types";

type AppLayoutProps = {
  accessToken: string | null;
  branding: LayoutBranding;
  shell: LayoutShell;
};

const APP_HEADER_NAVIGATION_MENU_CONFIG = createAppHeaderNavigationMenuConfig();

export function AppLayout(props: AppLayoutProps) {
  const routeContext = useAppRouteRenderContext();
  const isAuthenticated = Boolean(props.accessToken);
  const settingsProps = routeContext.settingsProps;
  const roles: string[] = [];

  if (settingsProps.adminCapabilities.users) {
    roles.push("AdminUsers");
  }
  if (settingsProps.adminCapabilities.invitations) {
    roles.push("InviteUsers");
  }
  if (settingsProps.adminCapabilities.groups) {
    roles.push("AdminGroups");
  }
  if (settingsProps.adminCapabilities.roles) {
    roles.push("AdminRoles");
  }
  if (settingsProps.adminCapabilities.content) {
    roles.push("ContentAdmin");
  }
  if (settingsProps.adminCapabilities.contentTypes) {
    roles.push("CmsTypeAdmin");
  }

  if (
    settingsProps.adminCapabilities.users
    && settingsProps.adminCapabilities.invitations
    && settingsProps.adminCapabilities.groups
    && settingsProps.adminCapabilities.roles
  ) {
    roles.push("Superuser");
  }

  const headerVariant = resolveAppHeaderPathVariant(settingsProps.locationPathname);

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <AppHeader
        branding={props.branding}
        variant={headerVariant}
        menu={{
          config: APP_HEADER_NAVIGATION_MENU_CONFIG,
          visibilityContext: {
            isAuthenticated,
            pathname: settingsProps.locationPathname,
            roles,
          },
          onNavigate: (path) => settingsProps.navigateTo(path),
        }}
        authMenu={{
          isAuthenticated,
          currentUserName: props.shell.currentUsername,
          registrationEnabled: props.shell.registrationEnabled,
          onLogin: routeContext.publicAuthProps.onNavigateLogin,
          onRegister: routeContext.publicAuthProps.onNavigateRegister,
          onSettings: props.shell.onOpenSettings,
          onLogout: props.shell.onLogout,
          extraMenuItems: props.shell.showInviteUsers ? [{ label: "Invite Users", onSelect: () => props.shell.onInviteDialogOpenChange(true) }] : [],
        }}
      />

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
