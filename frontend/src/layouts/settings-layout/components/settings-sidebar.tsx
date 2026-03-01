import { Bell, Palette, Puzzle, Shield, User, UserCog, Users } from "lucide-react";

import type { AdminCapabilities } from "../../../app/hooks/types";
import {
  NavigationMenu,
  type NavigationMenuConfig,
  type NavigationVisibilityContext,
  type NavigationVisibilityEvaluator,
} from "../../../components/navigation-menu";

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
  const navigationConfig: NavigationMenuConfig = {
    sections: [
      {
        id: "settings",
        title: "Settings",
        requiresAuth: true,
        items: [
          {
            id: "settings-profile",
            label: "Profile",
            icon: "user",
            path: "/settings/profile",
            pathPatterns: ["/settings", "/settings/profile"],
            requiresAuth: true,
          },
          {
            id: "settings-notifications",
            label: "Notifications",
            icon: "bell",
            path: "/settings/notifications",
            requiresAuth: true,
          },
          {
            id: "settings-security",
            label: "Security",
            icon: "shield",
            path: "/settings/security",
            requiresAuth: true,
          },
          {
            id: "settings-groups",
            label: "Groups",
            icon: "users",
            path: "/settings/groups",
            pathPatterns: ["/settings/groups", "/settings/group/*"],
            requiresAuth: true,
          },
          {
            id: "settings-theme",
            label: "Theme",
            icon: "palette",
            path: "/settings/theme",
            requiresAuth: true,
          },
          ...props.settingsExtensionItems.map((item) => ({
            id: `settings-extension-${item.id}`,
            label: item.label,
            icon: "puzzle",
            path: `/settings/extensions/${item.id}`,
            pathPatterns: [`/settings/extensions/${item.id}`, `/settings/extensions/${item.id}/*`],
            requiresAuth: true,
          })),
        ],
      },
      {
        id: "administration",
        title: "Administration",
        requiresAuth: true,
        visibleWhen: "canAccessAdmin",
        items: [
          {
            id: "admin-users",
            label: "Users",
            icon: "userCog",
            path: "/settings/admin/users",
            pathPatterns: ["/settings/admin", "/settings/admin/users", "/settings/admin/users/*"],
            requiresAuth: true,
            visibleWhen: "canManageUsers",
          },
          {
            id: "admin-invitations",
            label: "Invitations",
            icon: "users",
            path: "/settings/admin/invitations",
            requiresAuth: true,
            visibleWhen: "canManageInvitations",
          },
          {
            id: "admin-notifications",
            label: "Notifications",
            icon: "bell",
            path: "/settings/admin/notifications",
            requiresAuth: true,
            visibleWhen: "canManageRoles",
          },
          {
            id: "admin-roles",
            label: "Roles",
            icon: "shield",
            path: "/settings/admin/roles",
            requiresAuth: true,
            visibleWhen: "canManageRoles",
          },
          ...props.adminExtensionItems.map((item) => ({
            id: `admin-extension-${item.id}`,
            label: item.label,
            icon: "puzzle",
            path: `/settings/extensions/${item.id}`,
            pathPatterns: [`/settings/extensions/${item.id}`, `/settings/extensions/${item.id}/*`],
            requiresAuth: true,
          })),
        ],
      },
    ],
  };

  const visibilityEvaluators: Record<string, NavigationVisibilityEvaluator> = {
    canAccessAdmin: (context) => Boolean(context.canAccessAdmin),
    canManageUsers: (context) => Boolean((context.adminCapabilities as AdminCapabilities).users),
    canManageInvitations: (context) => Boolean((context.adminCapabilities as AdminCapabilities).invitations),
    canManageRoles: (context) => Boolean((context.adminCapabilities as AdminCapabilities).roles),
  };

  const visibilityContext: NavigationVisibilityContext = {
    isAuthenticated: true,
    pathname: props.locationPathname,
    canAccessAdmin: props.canAccessAdmin,
    adminCapabilities: props.adminCapabilities,
    selectedExtensionId: props.selectedExtensionId,
  };

  const iconRegistry = {
    user: User,
    bell: Bell,
    shield: Shield,
    users: Users,
    palette: Palette,
    puzzle: Puzzle,
    userCog: UserCog,
  };

  return (
    <NavigationMenu
      config={navigationConfig}
      pathname={props.locationPathname}
      isAuthenticated
      iconRegistry={iconRegistry}
      visibilityContext={visibilityContext}
      visibilityEvaluators={visibilityEvaluators}
      onNavigate={(path) => {
        const extensionPrefix = "/settings/extensions/";
        if (path.startsWith(extensionPrefix)) {
          props.onNavigateExtension(path.slice(extensionPrefix.length));
          return;
        }
        props.onNavigateTo(path);
      }}
    />
  );
}
