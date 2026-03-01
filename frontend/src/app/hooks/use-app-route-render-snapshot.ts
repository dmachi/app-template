import type { AppRouteRenderContextValue } from "../app-route-render-context";
import type { ThemeOption } from "../theme-provider";
import type { AuthProviderMeta, ProfilePropertyCatalogItem } from "../../lib/api";
import type { AdminCapabilities } from "./types";

export type AppRouteRenderSnapshotParams = {
  registrationEnabled: boolean;
  locationPathname: string;
  authMetaLoaded: boolean;
  authProviders: AuthProviderMeta[];
  onLogin: (credentials: { usernameOrEmail: string; password: string }) => Promise<void>;
  onRegister: (payload: {
    username: string;
    email: string;
    password: string;
    displayName: string;
    profileProperties: Record<string, unknown>;
  }) => Promise<void>;
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
  onProviderStart: (providerId: string) => Promise<void>;
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

export function buildAppRouteRenderSnapshot(params: AppRouteRenderSnapshotParams): AppRouteRenderContextValue {
  return {
    isAuthenticated: true,
    publicAuthProps: {
      registrationEnabled: params.registrationEnabled,
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
