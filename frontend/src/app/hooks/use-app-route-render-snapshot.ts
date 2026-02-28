import type { Dispatch, FormEvent, SetStateAction } from "react";

import type { AppRouteRenderContextValue } from "../app-route-render-context";
import type { ThemeOption } from "../theme-provider";
import type { AuthProviderMeta, NotificationItem, ProfilePropertyCatalogItem, ProfilePropertyLinkItem } from "../../lib/api";

type UseAppRouteRenderSnapshotParams = {
  appName: string;
  appIconNode: React.ReactNode;
  registrationEnabled: boolean;
  locationPathname: string;
  authMetaLoaded: boolean;
  authProviders: AuthProviderMeta[];
  usernameOrEmail: string;
  password: string;
  setUsernameOrEmail: Dispatch<SetStateAction<string>>;
  setPassword: Dispatch<SetStateAction<string>>;
  handleLogin: (event: FormEvent) => Promise<void>;
  registerUsername: string;
  setRegisterUsername: Dispatch<SetStateAction<string>>;
  registerEmail: string;
  setRegisterEmail: Dispatch<SetStateAction<string>>;
  registerPassword: string;
  setRegisterPassword: Dispatch<SetStateAction<string>>;
  registerDisplayName: string;
  setRegisterDisplayName: Dispatch<SetStateAction<string>>;
  handleRegister: (event: FormEvent) => Promise<void>;
  registerProfilePropertyCatalog: ProfilePropertyCatalogItem[];
  registerProfileProperties: Record<string, unknown>;
  setRegisterProfileProperties: Dispatch<SetStateAction<Record<string, unknown>>>;
  getRegisterLinkItems: (key: string) => ProfilePropertyLinkItem[];
  emailVerificationToken: string | null;
  invitationToken: string | null;
  invitationAcceptanceMessage: string | null;
  acceptingInvitation: boolean;
  error: string | null;
  onNavigateHome: () => void;
  onNavigateLogin: () => void;
  onNavigateRegister: () => void;
  onNavigateToAuthWithInvite: (view: "login" | "register") => void;
  onProviderStart: (providerId: string) => Promise<void>;
  currentUsername: string;
  homeNotifications: NotificationItem[];
  onHomeAcknowledge: (notificationId: string) => void;
  onOpenTask: (notification: NotificationItem) => void;
  onGoToSettings: () => void;
  canAccessAdmin: boolean | null;
  adminCapabilities: { users: boolean; groups: boolean; invitations: boolean; roles: boolean };
  selectedExtensionId: string | null;
  selectedGroupId: string | null;
  selectedAdminUserId: string | null;
  notificationRefreshSignal: number;
  theme: ThemeOption;
  setTheme: (nextTheme: ThemeOption) => void;
  accessToken: string;
  navigateTo: (to: string, replace?: boolean) => void;
};

export function useAppRouteRenderSnapshot(params: UseAppRouteRenderSnapshotParams): AppRouteRenderContextValue {
  return {
    isAuthenticated: true,
    publicAuthProps: {
      appName: params.appName,
      appIconNode: params.appIconNode,
      registrationEnabled: params.registrationEnabled,
      locationPathname: params.locationPathname,
      authMetaLoaded: params.authMetaLoaded,
      authProviders: params.authProviders,
      usernameOrEmail: params.usernameOrEmail,
      password: params.password,
      setUsernameOrEmail: params.setUsernameOrEmail,
      setPassword: params.setPassword,
      handleLogin: params.handleLogin,
      registerUsername: params.registerUsername,
      setRegisterUsername: params.setRegisterUsername,
      registerEmail: params.registerEmail,
      setRegisterEmail: params.setRegisterEmail,
      registerPassword: params.registerPassword,
      setRegisterPassword: params.setRegisterPassword,
      registerDisplayName: params.registerDisplayName,
      setRegisterDisplayName: params.setRegisterDisplayName,
      handleRegister: params.handleRegister,
      registerProfilePropertyCatalog: params.registerProfilePropertyCatalog,
      registerProfileProperties: params.registerProfileProperties,
      setRegisterProfileProperties: params.setRegisterProfileProperties,
      getRegisterLinkItems: params.getRegisterLinkItems,
      emailVerificationToken: params.emailVerificationToken,
      invitationToken: params.invitationToken,
      invitationAcceptanceMessage: params.invitationAcceptanceMessage,
      acceptingInvitation: params.acceptingInvitation,
      error: params.error,
      onNavigateHome: params.onNavigateHome,
      onNavigateLogin: params.onNavigateLogin,
      onNavigateRegister: params.onNavigateRegister,
      onNavigateToAuthWithInvite: params.onNavigateToAuthWithInvite,
      onProviderStart: params.onProviderStart,
    },
    homeProps: {
      currentUsername: params.currentUsername,
      homeNotifications: params.homeNotifications,
      onAcknowledge: params.onHomeAcknowledge,
      onOpenTask: params.onOpenTask,
      onGoToSettings: params.onGoToSettings,
    },
    settingsProps: {
      locationPathname: params.locationPathname,
      canAccessAdmin: Boolean(params.canAccessAdmin),
      adminCapabilities: params.adminCapabilities,
      selectedExtensionId: params.selectedExtensionId,
      selectedGroupId: params.selectedGroupId,
      selectedAdminUserId: params.selectedAdminUserId,
      accessToken: params.accessToken,
      notificationRefreshSignal: params.notificationRefreshSignal,
      theme: params.theme,
      setTheme: params.setTheme,
      emailVerificationToken: params.emailVerificationToken,
      invitationToken: params.invitationToken,
      registrationEnabled: params.registrationEnabled,
      authProviders: params.authProviders,
      invitationAcceptanceMessage: params.invitationAcceptanceMessage,
      acceptingInvitation: params.acceptingInvitation,
      onProviderStart: params.onProviderStart,
      navigateTo: params.navigateTo,
    },
  };
}
