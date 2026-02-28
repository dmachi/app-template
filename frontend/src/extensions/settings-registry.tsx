import { Suspense, lazy, type ReactNode } from "react";

const SampleSettingsPage = lazy(async () => {
  const module = await import("./sample-settings-page");
  return { default: module.SampleSettingsPage };
});

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
    render: ({ accessToken }) => (
      <Suspense fallback={<p className="text-sm text-slate-500">Loading extension...</p>}>
        <SampleSettingsPage accessToken={accessToken} />
      </Suspense>
    ),
  },
];

export function getSettingsExtensions(context: SettingsExtensionContext): SettingsExtensionItem[] {
  return SETTINGS_EXTENSIONS.filter((item) => (item.isVisible ? item.isVisible(context) : true));
}
