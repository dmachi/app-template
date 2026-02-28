import { useCallback } from "react";

import { renderAppIcon } from "./app/app-branding";
import { AppRootPresenter } from "./app/app-root-presenter";
import { useAppAuthActions } from "./app/hooks/use-app-auth-actions";
import { getProfilePropertyLinkItems, useAppAuthFormState } from "./app/hooks/use-app-auth-form-state";
import { useAppAuthMetaState } from "./app/hooks/use-app-auth-meta-state";
import { useAppHomeNotifications } from "./app/hooks/use-app-home-notifications";
import { useAppNavigation } from "./app/hooks/use-app-navigation";
import { useAppNotificationState } from "./app/hooks/use-app-notification-state";
import { useAppOrchestration } from "./app/hooks/use-app-orchestration";
import { useAppRouteContextPublication } from "./app/hooks/use-app-route-context-publication";
import { useAppRouteRenderSnapshot } from "./app/hooks/use-app-route-render-snapshot";
import { useAppRouteTokens } from "./app/hooks/use-app-route-tokens";
import { useAppSessionState } from "./app/hooks/use-app-session-state";
import { isActionRequiredToast, useAppToastActions } from "./app/hooks/use-app-toast-actions";
import { useSessionRestore } from "./app/hooks/use-app-bootstrap";
import { useAppRouteState } from "./app/hooks/use-app-route-state";
import { useTheme } from "./app/theme-provider";
import { API_BASE } from "./lib/api";

const REFRESH_TOKEN_STORAGE_KEY = "bst.refreshToken";
const INVITE_TOKEN_STORAGE_KEY = "bst.pendingInviteToken";

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

  const {
    usernameOrEmail,
    setUsernameOrEmail,
    password,
    setPassword,
    registerUsername,
    setRegisterUsername,
    registerEmail,
    setRegisterEmail,
    registerPassword,
    setRegisterPassword,
    registerDisplayName,
    setRegisterDisplayName,
    registerProfileProperties,
    setRegisterProfileProperties,
  } = useAppAuthFormState();

  useSessionRestore({
    refreshTokenStorageKey: REFRESH_TOKEN_STORAGE_KEY,
    setAccessToken,
    setRefreshToken,
    setRestoringSession,
  });

  const { selectedGroupId, selectedAdminUserId, selectedExtensionId } = useAppRouteState();
  const {
    locationPathname,
    isAcceptInviteRoute,
    tokenParam,
    inviteTokenParam,
    emailVerificationToken,
    invitationToken,
  } = useAppRouteTokens();

  const {
    homeNotifications,
    setHomeNotifications,
    refreshHomeNotifications,
    onHomeAcknowledge,
    onOpenTask,
  } = useAppHomeNotifications({
    accessToken,
    navigateTo,
    setNotificationRefreshSignal,
  });

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

  const getRegisterLinkItems = useCallback((key: string) => {
    return getProfilePropertyLinkItems(registerProfileProperties, key);
  }, [registerProfileProperties]);

  const onNavigateToAuthWithInvite = useCallback((nextView: "login" | "register") => {
    navigateToAuthWithInvite(nextView, pendingInvitationToken);
  }, [navigateToAuthWithInvite, pendingInvitationToken]);

  const { handleLogin, handleRegister, handleProviderStart, handleLogout } = useAppAuthActions({
    usernameOrEmail,
    password,
    registerUsername,
    registerEmail,
    registerPassword,
    registerDisplayName,
    registerProfileProperties,
    refreshTokenStorageKey: REFRESH_TOKEN_STORAGE_KEY,
    inviteTokenStorageKey: INVITE_TOKEN_STORAGE_KEY,
    refreshToken,
    pendingInvitationToken,
    setError,
    setAccessToken,
    setRefreshToken,
    setPassword,
    setUsernameOrEmail,
    setRegisterPassword,
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

  useAppOrchestration({
    accessToken,
    isAcceptInviteRoute,
    tokenParam,
    inviteTokenParam,
    inviteTokenStorageKey: INVITE_TOKEN_STORAGE_KEY,
    setPendingInvitationToken,
    setCurrentUsername,
    setTheme,
    setCanAccessAdmin,
    setAdminAccessChecked,
    setAdminCapabilities,
    pendingInvitationToken,
    acceptingInvitation,
    locationPathname,
    setAcceptingInvitation,
    setInvitationAcceptanceMessage,
    navigateHomeReplace,
    apiBase: API_BASE,
    refreshHomeNotifications,
    setRealtimePopups,
    setHomeNotifications,
    setNotificationRefreshSignal,
    restoringSession,
    canAccessAdmin,
    adminAccessChecked,
    adminCapabilities,
    selectedGroupId,
    selectedExtensionId,
    navigateTo,
  });

  const authenticatedOutletContext = useAppRouteRenderSnapshot({
    appName,
    appIconNode: renderAppIcon(appIcon),
    registrationEnabled,
    locationPathname,
    authMetaLoaded,
    authProviders,
    usernameOrEmail,
    password,
    setUsernameOrEmail,
    setPassword,
    handleLogin,
    registerUsername,
    setRegisterUsername,
    registerEmail,
    setRegisterEmail,
    registerPassword,
    setRegisterPassword,
    registerDisplayName,
    setRegisterDisplayName,
    handleRegister,
    registerProfilePropertyCatalog,
    registerProfileProperties,
    setRegisterProfileProperties,
    getRegisterLinkItems,
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
    currentUsername,
    homeNotifications,
    onHomeAcknowledge,
    onOpenTask,
    onGoToSettings: () => navigateTo("/settings/profile"),
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

  const appIconNode = renderAppIcon(appIcon);

  useAppRouteContextPublication({
    restoringSession,
    accessToken,
    authenticatedOutletContext,
  });

  return (
    <AppRootPresenter
      restoringSession={restoringSession}
      appName={appName}
      appIconNode={appIconNode}
      accessToken={accessToken}
      currentUsername={currentUsername}
      registrationEnabled={registrationEnabled}
      onOpenSettings={() => navigateSettingsProfile(locationPathname === "/settings/profile")}
      onLogout={handleLogout}
      showInviteUsers={adminCapabilities.invitations}
      inviteDialogOpen={inviteDialogOpen}
      onInviteDialogOpenChange={setInviteDialogOpen}
      realtimePopups={realtimePopups}
      clientPopups={clientPopups}
      isActionRequiredToast={isActionRequiredToast}
      onRemoveToast={removeToast}
      onToastManualClose={onToastManualClose}
      onToastAcknowledge={onToastAcknowledge}
      onToastOpenTask={onToastOpenTask}
      onRemoveClientToast={removeClientToast}
    />
  );
}
