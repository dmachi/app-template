import type { ProfilePropertyCatalogItem } from "../../lib/api";
import type { ThemeOption } from "../theme-provider";
import type { AppRouteRenderSnapshotParams } from "./use-app-route-render-snapshot";
import type { AdminCapabilities } from "./types";

type BuildAppRouteRenderSnapshotParamsInput = {
  registrationEnabled: boolean;
  locationPathname: string;
  authMetaLoaded: boolean;
  authProviders: AppRouteRenderSnapshotParams["authProviders"];
  onLogin: AppRouteRenderSnapshotParams["onLogin"];
  onRegister: AppRouteRenderSnapshotParams["onRegister"];
  registerProfilePropertyCatalog: ProfilePropertyCatalogItem[];
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
  adminCapabilities: AdminCapabilities;
  selectedExtensionId: string | null;
  selectedGroupId: string | null;
  selectedAdminUserId: string | null;
  notificationRefreshSignal: number;
  theme: ThemeOption;
  setTheme: (nextTheme: ThemeOption) => void;
  accessToken: string;
  navigateTo: (to: string, replace?: boolean) => void;
};

export function buildAppRouteRenderSnapshotParams(params: BuildAppRouteRenderSnapshotParamsInput): AppRouteRenderSnapshotParams {
  return {
    registrationEnabled: params.registrationEnabled,
    locationPathname: params.locationPathname,
    authMetaLoaded: params.authMetaLoaded,
    authProviders: params.authProviders,
    onLogin: params.onLogin,
    onRegister: params.onRegister,
    registerProfilePropertyCatalog: params.registerProfilePropertyCatalog,
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