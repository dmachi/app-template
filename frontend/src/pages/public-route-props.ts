import type { AuthProviderMeta, ProfilePropertyCatalogItem } from "../lib/api";

export type PublicRouteProps = {
  registrationEnabled: boolean;
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
};
