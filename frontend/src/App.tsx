import { useCallback, useEffect } from "react";

import { renderAppIcon } from "./app/app-branding";
import { AppRootPresenter } from "./app/app-root-presenter";
import { useAppAuthActions } from "./app/hooks/use-app-auth-actions";
import { useAppAuthMetaState } from "./app/hooks/use-app-auth-meta-state";
import { useAutoAcceptInvitation, usePendingInvitationTokenSync } from "./app/hooks/use-app-invitations";
import { useAppNavigation } from "./app/hooks/use-app-navigation";
import { useAppNotificationState } from "./app/hooks/use-app-notification-state";
import { useAppRouteContextPublication } from "./app/hooks/use-app-route-context-publication";
import { buildAppRouteRenderSnapshotParams } from "./app/hooks/use-app-route-render-snapshot-params";
import { buildAppRootPresenterProps } from "./app/hooks/use-app-root-presenter-props";
import { buildAppRouteRenderSnapshot } from "./app/hooks/use-app-route-render-snapshot";
import { useAppRouteTokens } from "./app/hooks/use-app-route-tokens";
import { useAppSessionState } from "./app/hooks/use-app-session-state";
import { isActionRequiredToast, useAppToastActions } from "./app/hooks/use-app-toast-actions";
import { useProfileAndAdminBootstrap, useSessionAutoRefresh, useSessionRestore } from "./app/hooks/use-app-bootstrap";
import { useRouteGuards } from "./app/hooks/use-auth-route-guards";
import { useRealtimeNotifications } from "./app/hooks/use-realtime-notifications-feed";
import { useAppRouteState } from "./app/hooks/use-app-route-state";
import { useTheme } from "./app/theme-provider";
import { API_BASE } from "./lib/api";

const REFRESH_TOKEN_STORAGE_KEY = "refreshToken";
const INVITE_TOKEN_STORAGE_KEY = "pendingInviteToken";

export function App() {
  const {
    navigateTo,
    navigateHome,
    navigateLogin,
    navigateRegister,
    navigateSettingsProfile,
    navigateHomeReplace,
    navigateToAuthWithInvite,
  } = useAppNavigation();
  const {
    appName,
    appIcon,
    authProviders,
    registrationEnabled,
    authMetaLoaded,
    registerProfilePropertyCatalog,
    error,
    setError,
  } = useAppAuthMetaState();
  const {
    accessToken,
    setAccessToken,
    refreshToken,
    setRefreshToken,
    restoringSession,
    setRestoringSession,
    currentUsername,
    setCurrentUsername,
    canAccessAdmin,
    setCanAccessAdmin,
    adminAccessChecked,
    setAdminAccessChecked,
    adminCapabilities,
    setAdminCapabilities,
    pendingInvitationToken,
    setPendingInvitationToken,
    acceptingInvitation,
    setAcceptingInvitation,
    invitationAcceptanceMessage,
    setInvitationAcceptanceMessage,
    inviteDialogOpen,
    setInviteDialogOpen,
  } = useAppSessionState();
  const { theme, setTheme } = useTheme();
  const {
    realtimePopups,
    setRealtimePopups,
    clientPopups,
    setClientPopups,
    notificationRefreshSignal,
    setNotificationRefreshSignal,
  } = useAppNotificationState();

  useEffect(() => {
    document.title = appName;
  }, [appName]);

  useSessionRestore({
    refreshTokenStorageKey: REFRESH_TOKEN_STORAGE_KEY,
    setAccessToken,
    setRefreshToken,
    setRestoringSession,
  });

  useSessionAutoRefresh({
    accessToken,
    refreshToken,
    refreshTokenStorageKey: REFRESH_TOKEN_STORAGE_KEY,
    setAccessToken,
    setRefreshToken,
  });

  const { selectedGroupId, selectedAdminUserId, selectedExtensionId } = useAppRouteState();
  const {
    locationPathname,
    isAcceptInviteRoute,
    tokenParam,
    inviteTokenParam,
    oauthReturnTo,
    emailVerificationToken,
    invitationToken,
  } = useAppRouteTokens();

  const {
    removeToast,
    removeClientToast,
    onToastManualClose,
    onToastAcknowledge,
    onToastOpenTask,
  } = useAppToastActions({
    accessToken,
    navigateTo,
    setRealtimePopups,
    setClientPopups,
    setNotificationRefreshSignal,
  });

  const onNavigateToAuthWithInvite = useCallback((nextView: "login" | "register") => {
    navigateToAuthWithInvite(nextView, pendingInvitationToken);
  }, [navigateToAuthWithInvite, pendingInvitationToken]);

  const { handleLogin, handleRegister, handleProviderStart, handleLogout } = useAppAuthActions({
    refreshTokenStorageKey: REFRESH_TOKEN_STORAGE_KEY,
    inviteTokenStorageKey: INVITE_TOKEN_STORAGE_KEY,
    refreshToken,
    pendingInvitationToken,
    setError,
    setAccessToken,
    setRefreshToken,
    setCurrentUsername,
    setTheme,
    setPendingInvitationToken,
    setAcceptingInvitation,
    setInvitationAcceptanceMessage,
    setAdminCapabilities,
    setInviteDialogOpen,
    navigateHome,
    navigateLogin,
    navigateTo,
  });

  usePendingInvitationTokenSync({
    isAcceptInviteRoute,
    tokenParam,
    inviteTokenParam,
    inviteTokenStorageKey: INVITE_TOKEN_STORAGE_KEY,
    setPendingInvitationToken,
  });

  useProfileAndAdminBootstrap({
    accessToken,
    setCurrentUsername,
    setTheme,
    setCanAccessAdmin,
    setAdminAccessChecked,
    setAdminCapabilities,
  });

  useAutoAcceptInvitation({
    accessToken,
    pendingInvitationToken,
    acceptingInvitation,
    locationPathname,
    inviteTokenStorageKey: INVITE_TOKEN_STORAGE_KEY,
    setAcceptingInvitation,
    setInvitationAcceptanceMessage,
    setPendingInvitationToken,
    navigateHomeReplace,
  });

  useRealtimeNotifications({
    accessToken,
    locationPathname,
    apiBase: API_BASE,
    setRealtimePopups,
    setNotificationRefreshSignal,
  });

  useRouteGuards({
    restoringSession,
    accessToken,
    canAccessAdmin,
    adminAccessChecked,
    adminCapabilities,
    locationPathname,
    oauthReturnTo,
    selectedGroupId,
    selectedExtensionId,
    navigateTo,
  });

  const appIconNode = renderAppIcon(appIcon);
  const routeRenderSnapshotParams = buildAppRouteRenderSnapshotParams({
    registrationEnabled,
    locationPathname,
    authMetaLoaded,
    authProviders,
    onLogin: handleLogin,
    onRegister: handleRegister,
    registerProfilePropertyCatalog,
    emailVerificationToken,
    invitationToken,
    invitationAcceptanceMessage,
    acceptingInvitation,
    error,
    onNavigateHome: navigateHome,
    onNavigateLogin: navigateLogin,
    onNavigateRegister: navigateRegister,
    onNavigateToAuthWithInvite,
    onProviderStart: handleProviderStart,
    canAccessAdmin,
    adminCapabilities,
    selectedExtensionId,
    selectedGroupId,
    selectedAdminUserId,
    notificationRefreshSignal,
    theme,
    setTheme,
    accessToken: accessToken ?? "",
    navigateTo,
  });
  const { branding: presenterBranding, shell: presenterShell } = buildAppRootPresenterProps({
    appName,
    appIconNode,
    currentUsername,
    registrationEnabled,
    onOpenSettings: () => navigateSettingsProfile(locationPathname === "/settings/profile"),
    onLogout: handleLogout,
    showInviteUsers: adminCapabilities.invitations,
    inviteDialogOpen,
    onInviteDialogOpenChange: setInviteDialogOpen,
    realtimePopups,
    clientPopups,
    isActionRequiredToast,
    onRemoveToast: removeToast,
    onToastManualClose,
    onToastAcknowledge,
    onToastOpenTask,
    onRemoveClientToast: removeClientToast,
  });
  const authenticatedOutletContext = {
    ...buildAppRouteRenderSnapshot(routeRenderSnapshotParams),
    branding: presenterBranding,
    shell: presenterShell,
  };

  useAppRouteContextPublication({
    restoringSession,
    accessToken,
    authenticatedOutletContext,
  });

  return (
    <AppRootPresenter
      restoringSession={restoringSession}
      accessToken={accessToken}
      branding={presenterBranding}
      shell={presenterShell}
    />
  );
}
