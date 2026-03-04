import type { ComponentType } from "react";

import type { AdminCapabilities } from "../app/hooks/types";
import type { NavigationItemConfig, NavigationSectionConfig } from "../components/navigation-menu";
import type { SettingsExtensionItem } from "../extensions/settings-registry";

const BUILT_IN_EXTENSION_SECTIONS = new Set(["settings", "administration", "content-management"]);

type ExtensionNavigationItem = {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  roles?: string[];
};

export type SettingsExtensionNavigationInput = {
  extensionItems: SettingsExtensionItem[];
  additionalAdminItems: NavigationItemConfig[];
};

export type SettingsExtensionNavigationOutput = {
  additionalSettingsItems: NavigationItemConfig[];
  additionalAdminItems: NavigationItemConfig[];
  additionalContentManagementItems: NavigationItemConfig[];
  additionalSections: NavigationSectionConfig[];
};

export type SettingsNavigationContext = {
  canAccessAdmin: boolean;
  adminCapabilities: AdminCapabilities;
};

export const DEFAULT_SETTINGS_NAVIGATION_CONTEXT: SettingsNavigationContext = {
  canAccessAdmin: true,
  adminCapabilities: {
    users: true,
    groups: true,
    invitations: true,
    roles: true,
    content: true,
    contentTypes: true,
  },
};

export function formatSectionTitle(sectionId: string): string {
  return sectionId
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function buildExtensionNavigationItem(item: ExtensionNavigationItem, sectionId: string): NavigationItemConfig {
  const isSettingsSection = sectionId === "settings";
  const basePath = isSettingsSection ? "/settings" : "/settings/admin";
  const path = `${basePath}/${item.id}`;

  return {
    id: `${sectionId}-extension-${item.id}`,
    label: item.label,
    icon: item.icon,
    path,
    pathPatterns: [path, `${path}/*`],
    requiresAuth: true,
    roles: item.roles,
  };
}

export function buildSettingsExtensionNavigationItems(
  input: SettingsExtensionNavigationInput,
): SettingsExtensionNavigationOutput {
  const extensionItemsBySection = input.extensionItems.reduce<Record<string, SettingsExtensionItem[]>>((acc, item) => {
    const sectionId = item.section || "settings";
    const sectionItems = acc[sectionId] || [];
    sectionItems.push(item);
    acc[sectionId] = sectionItems;
    return acc;
  }, {});

  const additionalSettingsItems = (extensionItemsBySection.settings || []).map((item) =>
    buildExtensionNavigationItem(item, "settings"),
  );

  const administrationSectionItems = (extensionItemsBySection.administration || []).map((item) =>
    buildExtensionNavigationItem(item, "administration"),
  );

  const additionalContentManagementItems = (extensionItemsBySection["content-management"] || []).map((item) =>
    buildExtensionNavigationItem(item, "content-management"),
  );

  const additionalSections = Object.entries(extensionItemsBySection)
    .filter(([sectionId]) => !BUILT_IN_EXTENSION_SECTIONS.has(sectionId))
    .map(([sectionId, items]) => ({
      id: sectionId,
      title: formatSectionTitle(sectionId),
      requiresAuth: true,
      items: items.map((item) => buildExtensionNavigationItem(item, sectionId)),
    }));

  return {
    additionalSettingsItems,
    additionalAdminItems: [...input.additionalAdminItems, ...administrationSectionItems],
    additionalContentManagementItems,
    additionalSections,
  };
}
