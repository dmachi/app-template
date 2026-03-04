import type { AdminCapabilities as ApiAdminCapabilities } from "../../lib/api";
import type { AdminCapabilities } from "../../app/hooks/types";

export const adminCapabilitiesDefaultsOverride: Partial<AdminCapabilities> = {};

export function mapApiAdminCapabilitiesOverride(
  _capabilities: ApiAdminCapabilities,
): Partial<AdminCapabilities> | null {
  return null;
}
