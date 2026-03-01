import type { ReactNode } from "react";

import type { ProfilePropertyCatalogItem, ProfilePropertyLinkItem } from "../../lib/api";
import type { ThemeOption } from "../theme-provider";
import type { AppRouteRenderSnapshotParams } from "./use-app-route-render-snapshot";

type UseAppRouteRenderSnapshotParamsParams = {
  appName: string;
  appIconNode: ReactNode;
  registrationEnabled: boolean;
  locationPathname: string;
  authMetaLoaded: boolean;
  authProviders: AppRouteRenderSnapshotParams["authProviders"];
  usernameOrEmail: string;
  password: string;
  setUsernameOrEmail: AppRouteRenderSnapshotParams["setUsernameOrEmail"];
  setPassword: AppRouteRenderSnapshotParams["setPassword"];
  handleLogin: AppRouteRenderSnapshotParams["handleLogin"];
  registerUsername: string;
  setRegisterUsername: AppRouteRenderSnapshotParams["setRegisterUsername"];
  registerEmail: string;
  setRegisterEmail: AppRouteRenderSnapshotParams["setRegisterEmail"];
  registerPassword: string;
  setRegisterPassword: AppRouteRenderSnapshotParams["setRegisterPassword"];
  registerDisplayName: string;
  setRegisterDisplayName: AppRouteRenderSnapshotParams["setRegisterDisplayName"];
  handleRegister: AppRouteRenderSnapshotParams["handleRegister"];
  registerProfilePropertyCatalog: ProfilePropertyCatalogItem[];
  registerProfileProperties: Record<string, unknown>;
  setRegisterProfileProperties: AppRouteRenderSnapshotParams["setRegisterProfileProperties"];
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
  onProviderStart: AppRouteRenderSnapshotParams["onProviderStart"];
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

export function useAppRouteRenderSnapshotParams(params: UseAppRouteRenderSnapshotParamsParams): AppRouteRenderSnapshotParams {
  return {
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
    canAccessAdmin: params.canAccessAdmin,
    adminCapabilities: params.adminCapabilities,
    selectedExtensionId: params.selectedExtensionId,
    selectedGroupId: params.selectedGroupId,
    selectedAdminUserId: params.selectedAdminUserId,
    notificationRefreshSignal: params.notificationRefreshSignal,
    theme: params.theme,
    setTheme: params.setTheme,
    accessToken: params.accessToken,
    navigateTo: params.navigateTo,
  };
}