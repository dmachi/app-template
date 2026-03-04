export const additionalBuiltInAdminSegments: string[] = [];

export const additionalBuiltInSettingsSegments: string[] = [];

export function resolveSelectedExtensionIdOverride(
  _settingsExtensionId: string | null,
  _adminExtensionId: string | null,
): string | null | undefined {
  return undefined;
}
