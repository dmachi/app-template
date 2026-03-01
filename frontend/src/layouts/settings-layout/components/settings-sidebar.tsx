import { Button } from "../../../components/ui/button";
import type { AdminCapabilities } from "../../../app/hooks/types";

type SidebarExtensionItem = {
  id: string;
  label: string;
};

type SettingsSidebarProps = {
  locationPathname: string;
  canAccessAdmin: boolean;
  adminCapabilities: AdminCapabilities;
  selectedExtensionId: string | null;
  settingsExtensionItems: SidebarExtensionItem[];
  adminExtensionItems: SidebarExtensionItem[];
  onNavigateTo: (to: string) => void;
  onNavigateExtension: (extensionId: string) => void;
};

export function SettingsSidebar(props: SettingsSidebarProps) {
  const isProfile = props.locationPathname === "/settings" || props.locationPathname === "/settings/profile";
  const isNotifications = props.locationPathname === "/settings/notifications";
  const isSecurity = props.locationPathname === "/settings/security";
  const isGroups = props.locationPathname === "/settings/groups" || props.locationPathname.startsWith("/settings/group/");
  const isTheme = props.locationPathname === "/settings/theme";
  const isAdminUsers =
    props.locationPathname === "/settings/admin" ||
    props.locationPathname === "/settings/admin/users" ||
    props.locationPathname.startsWith("/settings/admin/users/");
  const isAdminInvitations = props.locationPathname === "/settings/admin/invitations";
  const isAdminNotifications = props.locationPathname === "/settings/admin/notifications";
  const isAdminRoles = props.locationPathname === "/settings/admin/roles";
  const isExtension = props.locationPathname.startsWith("/settings/extensions/");

  return (
    <aside className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
      <nav className="grid gap-3">
        <div className="grid gap-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Settings</p>
          <Button type="button" className={isProfile ? "bg-slate-100 dark:bg-slate-800" : ""} onClick={() => props.onNavigateTo("/settings/profile")}>Profile</Button>
          <Button type="button" className={isNotifications ? "bg-slate-100 dark:bg-slate-800" : ""} onClick={() => props.onNavigateTo("/settings/notifications")}>Notifications</Button>
          <Button type="button" className={isSecurity ? "bg-slate-100 dark:bg-slate-800" : ""} onClick={() => props.onNavigateTo("/settings/security")}>Security</Button>
          <Button type="button" className={isGroups ? "bg-slate-100 dark:bg-slate-800" : ""} onClick={() => props.onNavigateTo("/settings/groups")}>Groups</Button>
          <Button type="button" className={isTheme ? "bg-slate-100 dark:bg-slate-800" : ""} onClick={() => props.onNavigateTo("/settings/theme")}>Theme</Button>
          {props.settingsExtensionItems.map((item) => (
            <Button
              key={item.id}
              type="button"
              className={isExtension && props.selectedExtensionId === item.id ? "bg-slate-100 dark:bg-slate-800" : ""}
              onClick={() => props.onNavigateExtension(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {props.canAccessAdmin ? (
          <div className="grid gap-2">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Administration</p>
            {props.adminCapabilities.users ? (
              <Button type="button" className={isAdminUsers ? "bg-slate-100 dark:bg-slate-800" : ""} onClick={() => props.onNavigateTo("/settings/admin/users")}>Users</Button>
            ) : null}
            {props.adminCapabilities.invitations ? (
              <Button type="button" className={isAdminInvitations ? "bg-slate-100 dark:bg-slate-800" : ""} onClick={() => props.onNavigateTo("/settings/admin/invitations")}>Invitations</Button>
            ) : null}
            {props.adminCapabilities.roles ? (
              <Button type="button" className={isAdminNotifications ? "bg-slate-100 dark:bg-slate-800" : ""} onClick={() => props.onNavigateTo("/settings/admin/notifications")}>Notifications</Button>
            ) : null}
            {props.adminCapabilities.roles ? (
              <Button type="button" className={isAdminRoles ? "bg-slate-100 dark:bg-slate-800" : ""} onClick={() => props.onNavigateTo("/settings/admin/roles")}>Roles</Button>
            ) : null}
            {props.adminExtensionItems.map((item) => (
              <Button
                key={item.id}
                type="button"
                className={isExtension && props.selectedExtensionId === item.id ? "bg-slate-100 dark:bg-slate-800" : ""}
                onClick={() => props.onNavigateExtension(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        ) : null}
      </nav>
    </aside>
  );
}
