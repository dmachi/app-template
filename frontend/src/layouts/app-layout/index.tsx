import { Outlet } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { useAppRouteRenderContext } from "../../app/app-route-render-context";
import { AppHeader, getAppHeaderOffsetClassName } from "../../components/app-header";
import { AppNotificationToasts } from "../../components/app-notification-toasts";
import { InviteUsersDialog } from "../../components/invite-users-dialog";
import { createAppHeaderNavigationMenuConfig } from "../../config/app-header-menu";
import { resolveAppHeaderPathVariant } from "../../config/app-header-variants";
import { resolveAdditionalCapabilityRoles } from "../../extensions/app-hooks/layout-roles";
import { getMyJobStatusCounts } from "../../lib/api";
import type { LayoutBranding, LayoutShell } from "../../lib/layouts/types";
import { cn } from "../../lib/utils";

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
  const [jobsStatusCounts, setJobsStatusCounts] = useState({
    queued: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    cancelRequested: 0,
    canceled: 0,
  });
  const jobsCountsRequestSeqRef = useRef(0);
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
  roles.push(...resolveAdditionalCapabilityRoles(settingsProps.adminCapabilities));

  if (
    settingsProps.adminCapabilities.users
    && settingsProps.adminCapabilities.invitations
    && settingsProps.adminCapabilities.groups
    && settingsProps.adminCapabilities.roles
  ) {
    roles.push("Superuser");
  }

  const headerVariant = resolveAppHeaderPathVariant(settingsProps.locationPathname);
  const headerDisplay = headerVariant?.display;
  const isHeaderFixed = Boolean(headerDisplay?.fixed);
  const headerOffsetClassName = getAppHeaderOffsetClassName(headerDisplay);

  useEffect(() => {
    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const startPollingIfNeeded = (counts: { queued: number; running: number; cancelRequested: number }) => {
      const hasActiveJobs = counts.queued > 0 || counts.running > 0 || counts.cancelRequested > 0;
      if (hasActiveJobs && pollInterval == null) {
        pollInterval = setInterval(() => {
          void refreshCounts();
        }, 3000);
      }
      if (!hasActiveJobs && pollInterval != null) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const setCountsAndPolling = (counts: {
      queued: number;
      running: number;
      succeeded: number;
      failed: number;
      cancelRequested: number;
      canceled: number;
    }) => {
      setJobsStatusCounts(counts);
      startPollingIfNeeded({
        queued: counts.queued,
        running: counts.running,
        cancelRequested: counts.cancelRequested,
      });
    };

    async function refreshCounts() {
      const requestSeq = ++jobsCountsRequestSeqRef.current;

      if (!props.accessToken) {
        if (!cancelled && requestSeq === jobsCountsRequestSeqRef.current) {
          setCountsAndPolling({ queued: 0, running: 0, succeeded: 0, failed: 0, cancelRequested: 0, canceled: 0 });
        }
        return;
      }

      try {
        const payload = await getMyJobStatusCounts(props.accessToken);
        if (!cancelled && requestSeq === jobsCountsRequestSeqRef.current) {
          setCountsAndPolling(payload);
        }
      } catch {
        if (!cancelled && requestSeq === jobsCountsRequestSeqRef.current) {
          setCountsAndPolling({ queued: 0, running: 0, succeeded: 0, failed: 0, cancelRequested: 0, canceled: 0 });
        }
      }
    }

    const handleJobsUpdated = () => {
      void refreshCounts();
    };

    void refreshCounts();
    window.addEventListener("jobs:updated", handleJobsUpdated);
    return () => {
      cancelled = true;
      if (pollInterval != null) {
        clearInterval(pollInterval);
      }
      window.removeEventListener("jobs:updated", handleJobsUpdated);
    };
  }, [props.accessToken]);

  return (
    <div className={cn(isHeaderFixed ? "h-screen overflow-hidden" : "min-h-screen", "bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50")}>
      <AppHeader
        branding={props.branding}
        jobsStatusCounts={isAuthenticated ? jobsStatusCounts : { queued: 0, running: 0, succeeded: 0, failed: 0, cancelRequested: 0, canceled: 0 }}
        jobsBadgeShowOnlyActive={false}
        variant={headerVariant}
        display={headerDisplay}
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

      <main className={cn(isHeaderFixed ? "h-full overflow-y-auto" : "", headerOffsetClassName)}>
        <Outlet />
      </main>
    </div>
  );
}
