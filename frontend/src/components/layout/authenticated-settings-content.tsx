import { getSettingsExtensions } from "../../extensions/settings-registry";
import { AcceptInvitePage } from "../../pages/accept-invite-page";
import { VerifyEmailPage } from "../../pages/verify-email-page";
import { AdminInvitationsPage } from "../../settings/admin/pages/admin-invitations-page";
import { AdminNotificationsPage } from "../../settings/admin/pages/admin-notifications-page";
import { AdminRolesPage } from "../../settings/admin/pages/admin-roles-page";
import { AdminUserDetailPage } from "../../settings/admin/pages/admin-user-detail-page";
import { AdminUsersPage } from "../../settings/admin/pages/admin-users-page";
import { SettingsSidebar } from "../../settings/components/settings-sidebar";
import { GroupDetailPage } from "../../settings/pages/group-detail-page";
import { GroupsPage } from "../../settings/pages/groups-page";
import { NotificationsPage } from "../../settings/pages/notifications-page";
import { ProfilePage } from "../../settings/pages/profile-page";
import { SecurityPage } from "../../settings/pages/security-page";
import { ThemePage } from "../../settings/pages/theme-page";
import { AuthProviderMeta } from "../../lib/api";

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
          {isProfile ? <ProfilePage accessToken={props.accessToken} /> : null}
          {isNotifications ? <NotificationsPage accessToken={props.accessToken} refreshSignal={props.notificationRefreshSignal} /> : null}
          {isSecurity ? <SecurityPage /> : null}
          {isGroups ? (
            <GroupsPage
              accessToken={props.accessToken}
              canViewAllGroups={props.adminCapabilities.groups}
              onOpenGroup={(groupId) => {
                props.navigateTo(`/settings/group/${groupId}`);
              }}
            />
          ) : null}
          {isGroupDetail && props.selectedGroupId ? (
            <GroupDetailPage
              accessToken={props.accessToken}
              groupId={props.selectedGroupId}
              canAssignRoles={props.adminCapabilities.groups}
              onBack={() => props.navigateTo("/settings/groups")}
            />
          ) : null}
          {isTheme ? <ThemePage accessToken={props.accessToken} theme={props.theme} onThemeChange={props.setTheme} /> : null}
          {isVerifyEmail ? (
            <VerifyEmailPage
              token={props.emailVerificationToken}
              isAuthenticated={true}
              onGoHome={() => props.navigateTo("/")}
              onGoLogin={() => props.navigateTo("/login")}
            />
          ) : null}
          {isAcceptInvite ? (
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
          ) : null}
          {isAdminUsers ? (
            <AdminUsersPage
              accessToken={props.accessToken}
              onOpenUser={(userId) => props.navigateTo(`/settings/admin/users/${userId}`)}
              onOpenInvitations={() => props.navigateTo("/settings/admin/invitations")}
            />
          ) : null}
          {isAdminInvitations ? <AdminInvitationsPage accessToken={props.accessToken} /> : null}
          {isAdminNotifications ? <AdminNotificationsPage accessToken={props.accessToken} /> : null}
          {isAdminUserDetail && props.selectedAdminUserId ? (
            <AdminUserDetailPage accessToken={props.accessToken} userId={props.selectedAdminUserId} onBack={() => props.navigateTo("/settings/admin/users")} />
          ) : null}
          {isAdminRoles ? <AdminRolesPage accessToken={props.accessToken} /> : null}
          {isExtension && activeExtension ? activeExtension.render({ accessToken: props.accessToken }) : null}
        </section>
      </div>
    </main>
  );
}
