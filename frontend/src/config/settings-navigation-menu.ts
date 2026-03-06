import { Bell, KeyRound, Link2, Palette, Puzzle, Shield, User, UserCog, Users } from "lucide-react";

import type { NavigationItemConfig, NavigationMenuConfig, NavigationSectionConfig } from "../components/navigation-menu";

type CreateSettingsNavigationMenuConfigInput = {
  additionalSettingsItems?: NavigationItemConfig[];
  additionalAdminItems?: NavigationItemConfig[];
  additionalContentManagementItems?: NavigationItemConfig[];
  additionalSections?: NavigationSectionConfig[];
};

export function createSettingsNavigationMenuConfig(
  input: CreateSettingsNavigationMenuConfigInput,
): NavigationMenuConfig {
  const additionalSettingsItems = input.additionalSettingsItems || [];
  const additionalAdminItems = input.additionalAdminItems || [];
  const additionalContentManagementItems = input.additionalContentManagementItems || [];
  const additionalSections = input.additionalSections || [];

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
            id: "settings-access-tokens",
            label: "Access Tokens",
            icon: KeyRound,
            path: "/settings/access-tokens",
            requiresAuth: true,
          },
          {
            id: "settings-connected-apps",
            label: "Connected Apps",
            icon: Link2,
            path: "/settings/connected-apps",
            requiresAuth: true,
          },
          {
            id: "settings-linked-accounts",
            label: "Linked Accounts",
            icon: Link2,
            path: "/settings/linked-accounts",
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
          ...additionalSettingsItems,
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
          {
            id: "admin-oauth-clients",
            label: "OAuth Clients",
            icon: KeyRound,
            path: "/settings/admin/oauth/clients",
            requiresAuth: true,
            roles: ["Superuser"],
          },
          ...additionalAdminItems,
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
            roles: ["ContentAdmin", "Superuser"],
          },
          {
            id: "admin-media",
            label: "Media",
            icon: Puzzle,
            path: "/settings/admin/media",
            pathPatterns: ["/settings/admin/media"],
            requiresAuth: true,
            roles: ["ContentAdmin", "Superuser"],
          },
          {
            id: "admin-content-types",
            label: "Content Types",
            icon: Shield,
            path: "/settings/admin/content-types",
            requiresAuth: true,
            roles: ["CmsTypeAdmin"],
          },
          ...additionalContentManagementItems,
        ],
      },
      ...additionalSections,
    ],
  };
}
