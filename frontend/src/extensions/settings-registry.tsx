import type { ReactNode } from "react";
import type { ComponentType } from "react";

import type { AdminCapabilities } from "../app/hooks/types";
import type { NavigationItemConfig } from "../components/navigation-menu";

export type SettingsExtensionContext = {
  canAccessAdmin: boolean;
  adminCapabilities: AdminCapabilities;
};

export type SettingsExtensionItem = {
  id: string;
  label: string;
  section?: string;
  roles?: string[];
  icon?: ComponentType<{ className?: string }>;
  isVisible?: (context: SettingsExtensionContext) => boolean;
  render: (props: { accessToken: string }) => ReactNode;
};

type SettingsNavigationItem = NavigationItemConfig & {
  isVisible?: (context: SettingsExtensionContext) => boolean;
};

const SETTINGS_EXTENSIONS: SettingsExtensionItem[] = [];

const ADDITIONAL_ADMIN_ITEMS: SettingsNavigationItem[] = [];

export function getSettingsExtensions(context: SettingsExtensionContext): SettingsExtensionItem[] {
  return SETTINGS_EXTENSIONS.filter((item) => (item.isVisible ? item.isVisible(context) : true));
}

export function getAdditionalAdminItems(context: SettingsExtensionContext): NavigationItemConfig[] {
  return ADDITIONAL_ADMIN_ITEMS.filter((item) => (item.isVisible ? item.isVisible(context) : true));
}
