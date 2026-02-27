import type { ReactNode } from "react";

import { SampleSettingsPage } from "./sample-settings-page";

export type SettingsExtensionContext = {
  canAccessAdmin: boolean;
  adminCapabilities: { users: boolean; groups: boolean; invitations: boolean; roles: boolean };
};

export type SettingsExtensionItem = {
  id: string;
  label: string;
  section?: "settings" | "administration";
  isVisible?: (context: SettingsExtensionContext) => boolean;
  render: (props: { accessToken: string }) => ReactNode;
};

const SETTINGS_EXTENSIONS: SettingsExtensionItem[] = [
  {
    id: "sample-app-settings",
    label: "App Settings (Sample)",
    section: "settings",
    render: ({ accessToken }) => <SampleSettingsPage accessToken={accessToken} />,
  },
];

export function getSettingsExtensions(context: SettingsExtensionContext): SettingsExtensionItem[] {
  return SETTINGS_EXTENSIONS.filter((item) => (item.isVisible ? item.isVisible(context) : true));
}
