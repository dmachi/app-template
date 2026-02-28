import { Suspense, lazy } from "react";

import { getSettingsExtensions } from "../../extensions/settings-registry";
import { SettingsSidebar } from "../../settings/components/settings-sidebar";
import { AuthProviderMeta } from "../../lib/api";

const AcceptInvitePage = lazy(async () => {
  const module = await import("../../pages/accept-invite-page");
  return { default: module.AcceptInvitePage };
});
const VerifyEmailPage = lazy(async () => {
  const module = await import("../../pages/verify-email-page");
  return { default: module.VerifyEmailPage };
});
const AdminInvitationsPage = lazy(async () => {
  const module = await import("../../settings/admin/pages/admin-invitations-page");
  return { default: module.AdminInvitationsPage };
});
const AdminNotificationsPage = lazy(async () => {
  const module = await import("../../settings/admin/pages/admin-notifications-page");
  return { default: module.AdminNotificationsPage };
});
const AdminRolesPage = lazy(async () => {
  const module = await import("../../settings/admin/pages/admin-roles-page");
  return { default: module.AdminRolesPage };
});
const AdminUserDetailPage = lazy(async () => {
  const module = await import("../../settings/admin/pages/admin-user-detail-page");
  return { default: module.AdminUserDetailPage };
});
const AdminUsersPage = lazy(async () => {
  const module = await import("../../settings/admin/pages/admin-users-page");
  return { default: module.AdminUsersPage };
});
const GroupDetailPage = lazy(async () => {
  const module = await import("../../settings/pages/group-detail-page");
  return { default: module.GroupDetailPage };
});
const GroupsPage = lazy(async () => {
  const module = await import("../../settings/pages/groups-page");
  return { default: module.GroupsPage };
});
const NotificationsPage = lazy(async () => {
  const module = await import("../../settings/pages/notifications-page");
  return { default: module.NotificationsPage };
});
const ProfilePage = lazy(async () => {
  const module = await import("../../settings/pages/profile-page");
  return { default: module.ProfilePage };
});
const SecurityPage = lazy(async () => {
  const module = await import("../../settings/pages/security-page");
  return { default: module.SecurityPage };
});
const ThemePage = lazy(async () => {
  const module = await import("../../settings/pages/theme-page");
  return { default: module.ThemePage };
});

export type AuthenticatedSettingsContentProps = {
  locationPathname: string;
  canAccessAdmin: boolean;
  adminCapabilities: { users: boolean; groups: boolean; invitations: boolean; roles: boolean };
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

export function AuthenticatedSettingsContent(props: AuthenticatedSettingsContentProps) {
  const lazyFallback = <p className="text-sm text-slate-500">Loading...</p>;
  const settingsExtensions = getSettingsExtensions({ canAccessAdmin: props.canAccessAdmin, adminCapabilities: props.adminCapabilities });
  const settingsExtensionItems = settingsExtensions.filter((item) => (item.section ?? "settings") === "settings");
  const adminExtensionItems = settingsExtensions.filter((item) => item.section === "administration");
  const activeExtension = props.selectedExtensionId ? settingsExtensions.find((item) => item.id === props.selectedExtensionId) : null;
  const isProfile = props.locationPathname === "/settings" || props.locationPathname === "/settings/profile";
  const isNotifications = props.locationPathname === "/settings/notifications";
  const isSecurity = props.locationPathname === "/settings/security";
  const isGroups = props.locationPathname === "/settings/groups";
  const isGroupDetail = props.locationPathname.startsWith("/settings/group/");
  const isTheme = props.locationPathname === "/settings/theme";
  const isVerifyEmail = props.locationPathname === "/verify-email";
  const isAcceptInvite = props.locationPathname === "/accept-invite";
  const isAdminUsers = props.locationPathname === "/settings/admin" || props.locationPathname === "/settings/admin/users";
  const isAdminInvitations = props.locationPathname === "/settings/admin/invitations";
  const isAdminNotifications = props.locationPathname === "/settings/admin/notifications";
  const isAdminUserDetail = props.locationPathname.startsWith("/settings/admin/users/");
  const isAdminRoles = props.locationPathname === "/settings/admin/roles";
  const isExtension = props.locationPathname.startsWith("/settings/extensions/");

  return (
    <main className="w-full px-6 py-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <SettingsSidebar
          locationPathname={props.locationPathname}
          canAccessAdmin={props.canAccessAdmin}
          adminCapabilities={props.adminCapabilities}
          selectedExtensionId={props.selectedExtensionId}
          settingsExtensionItems={settingsExtensionItems}
          adminExtensionItems={adminExtensionItems}
          onNavigateTo={props.navigateTo}
          onNavigateExtension={(extensionId) => props.navigateTo(`/settings/extensions/${extensionId}`)}
        />

        <section>
          {isProfile ? (
            <Suspense fallback={lazyFallback}>
              <ProfilePage accessToken={props.accessToken} />
            </Suspense>
          ) : null}
          {isNotifications ? (
            <Suspense fallback={lazyFallback}>
              <NotificationsPage accessToken={props.accessToken} refreshSignal={props.notificationRefreshSignal} />
            </Suspense>
          ) : null}
          {isSecurity ? (
            <Suspense fallback={lazyFallback}>
              <SecurityPage />
            </Suspense>
          ) : null}
          {isGroups ? (
            <Suspense fallback={lazyFallback}>
              <GroupsPage
                accessToken={props.accessToken}
                canViewAllGroups={props.adminCapabilities.groups}
                onOpenGroup={(groupId) => {
                  props.navigateTo(`/settings/group/${groupId}`);
                }}
              />
            </Suspense>
          ) : null}
          {isGroupDetail && props.selectedGroupId ? (
            <Suspense fallback={lazyFallback}>
              <GroupDetailPage
                accessToken={props.accessToken}
                groupId={props.selectedGroupId}
                canAssignRoles={props.adminCapabilities.groups}
                onBack={() => props.navigateTo("/settings/groups")}
              />
            </Suspense>
          ) : null}
          {isTheme ? (
            <Suspense fallback={lazyFallback}>
              <ThemePage accessToken={props.accessToken} theme={props.theme} onThemeChange={props.setTheme} />
            </Suspense>
          ) : null}
          {isVerifyEmail ? (
            <Suspense fallback={lazyFallback}>
              <VerifyEmailPage
                token={props.emailVerificationToken}
                isAuthenticated={true}
                onGoHome={() => props.navigateTo("/")}
                onGoLogin={() => props.navigateTo("/login")}
              />
            </Suspense>
          ) : null}
          {isAcceptInvite ? (
            <Suspense fallback={lazyFallback}>
              <AcceptInvitePage
                token={props.invitationToken}
                registrationEnabled={props.registrationEnabled}
                authProviders={props.authProviders}
                isAuthenticated={true}
                acceptanceMessage={props.invitationAcceptanceMessage}
                accepting={props.acceptingInvitation}
                onLogin={() => props.navigateTo("/login")}
                onRegister={() => props.navigateTo("/register")}
                onProviderStart={props.onProviderStart}
                onGoHome={() => props.navigateTo("/")}
              />
            </Suspense>
          ) : null}
          {isAdminUsers ? (
            <Suspense fallback={lazyFallback}>
              <AdminUsersPage
                accessToken={props.accessToken}
                onOpenUser={(userId) => props.navigateTo(`/settings/admin/users/${userId}`)}
                onOpenInvitations={() => props.navigateTo("/settings/admin/invitations")}
              />
            </Suspense>
          ) : null}
          {isAdminInvitations ? (
            <Suspense fallback={lazyFallback}>
              <AdminInvitationsPage accessToken={props.accessToken} />
            </Suspense>
          ) : null}
          {isAdminNotifications ? (
            <Suspense fallback={lazyFallback}>
              <AdminNotificationsPage accessToken={props.accessToken} />
            </Suspense>
          ) : null}
          {isAdminUserDetail && props.selectedAdminUserId ? (
            <Suspense fallback={lazyFallback}>
              <AdminUserDetailPage accessToken={props.accessToken} userId={props.selectedAdminUserId} onBack={() => props.navigateTo("/settings/admin/users")} />
            </Suspense>
          ) : null}
          {isAdminRoles ? (
            <Suspense fallback={lazyFallback}>
              <AdminRolesPage accessToken={props.accessToken} />
            </Suspense>
          ) : null}
          {isExtension && activeExtension ? activeExtension.render({ accessToken: props.accessToken }) : null}
        </section>
      </div>
    </main>
  );
}
