import { Bell, Palette, Puzzle, Shield, User, UserCog, Users } from "lucide-react";

import type { NavigationMenuConfig } from "../components/navigation-menu";

export type SettingsNavigationExtensionItem = {
  id: string;
  label: string;
};

type CreateSettingsNavigationMenuConfigInput = {
  settingsExtensionItems: SettingsNavigationExtensionItem[];
  adminExtensionItems: SettingsNavigationExtensionItem[];
};

export function createSettingsNavigationMenuConfig(
  input: CreateSettingsNavigationMenuConfigInput,
): NavigationMenuConfig {
  return {
    sections: [
      {
        id: "settings",
        title: "Settings",
        requiresAuth: true,
        items: [
          {
            id: "settings-profile",
            label: "Profile",
            icon: User,
            path: "/settings/profile",
            pathPatterns: ["/settings", "/settings/profile"],
            requiresAuth: true,
          },
          {
            id: "settings-notifications",
            label: "Notifications",
            icon: Bell,
            path: "/settings/notifications",
            requiresAuth: true,
          },
          {
            id: "settings-security",
            label: "Security",
            icon: Shield,
            path: "/settings/security",
            requiresAuth: true,
          },
          {
            id: "settings-groups",
            label: "Groups",
            icon: Users,
            path: "/settings/groups",
            pathPatterns: ["/settings/groups", "/settings/group/*"],
            requiresAuth: true,
          },
          {
            id: "settings-theme",
            label: "Theme",
            icon: Palette,
            path: "/settings/theme",
            requiresAuth: true,
          },
          ...input.settingsExtensionItems.map((item) => ({
            id: `settings-extension-${item.id}`,
            label: item.label,
            icon: Puzzle,
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
        items: [
          {
            id: "admin-users",
            label: "Users",
            icon: UserCog,
            path: "/settings/admin/users",
            pathPatterns: ["/settings/admin", "/settings/admin/users", "/settings/admin/users/*"],
            requiresAuth: true,
            roles: ["AdminUsers"],
          },
          {
            id: "admin-invitations",
            label: "Invitations",
            icon: Users,
            path: "/settings/admin/invitations",
            requiresAuth: true,
            roles: ["InviteUsers"],
          },
          {
            id: "admin-notifications",
            label: "Notifications",
            icon: Bell,
            path: "/settings/admin/notifications",
            requiresAuth: true,
            roles: ["Superuser"],
          },
          {
            id: "admin-roles",
            label: "Roles",
            icon: Shield,
            path: "/settings/admin/roles",
            requiresAuth: true,
            roles: ["Superuser"],
          },
          ...input.adminExtensionItems.map((item) => ({
            id: `admin-extension-${item.id}`,
            label: item.label,
            icon: Puzzle,
            path: `/settings/extensions/${item.id}`,
            pathPatterns: [`/settings/extensions/${item.id}`, `/settings/extensions/${item.id}/*`],
            requiresAuth: true,
          })),
        ],
      },
      {
        id: "content-management",
        title: "Content Management",
        requiresAuth: true,
        items: [
          {
            id: "admin-content",
            label: "Content",
            icon: Puzzle,
            path: "/settings/admin/content",
            pathPatterns: ["/settings/admin/content", "/settings/admin/content/*"],
            requiresAuth: true,
            roles: ["ContentEditor", "Superuser"],
          },
          {
            id: "admin-media",
            label: "Media",
            icon: Puzzle,
            path: "/settings/admin/media",
            pathPatterns: ["/settings/admin/media"],
            requiresAuth: true,
            roles: ["ContentEditor", "Superuser"],
          },
          {
            id: "admin-content-types",
            label: "Content Types",
            icon: Shield,
            path: "/settings/admin/content-types",
            requiresAuth: true,
            roles: ["CmsTypeAdmin"],
          },
        ],
      },
    ],
  };
}
