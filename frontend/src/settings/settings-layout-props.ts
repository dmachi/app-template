import type { AdminCapabilities } from "../app/hooks/types";
import type { AuthProviderMeta } from "../lib/api";

export type SettingsLayoutProps = {
  locationPathname: string;
  canAccessAdmin: boolean;
  adminCapabilities: AdminCapabilities;
  selectedExtensionId: string | null;
  selectedGroupId: string | null;
  selectedAdminUserId: string | null;
  accessToken: string;
  notificationRefreshSignal: number;
  theme: "light" | "dark" | "system";
  setTheme: (nextTheme: "light" | "dark" | "system") => void;
  emailVerificationToken: string | null;
  invitationToken: string | null;
  registrationEnabled: boolean;
  authProviders: AuthProviderMeta[];
  invitationAcceptanceMessage: string | null;
  acceptingInvitation: boolean;
  onProviderStart: (providerId: string) => Promise<void>;
  navigateTo: (to: string, replace?: boolean) => void;
};
