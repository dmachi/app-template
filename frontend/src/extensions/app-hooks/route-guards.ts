import type { AdminCapabilities } from "../../app/hooks/types";

export function resolveAdminPathCapabilityOverride(_pathname: string, _capabilities: AdminCapabilities): boolean | undefined {
  return undefined;
}

export function resolveFirstAllowedAdminPathOverride(_capabilities: AdminCapabilities): string | null | undefined {
  return undefined;
}

export const additionalPublicUnauthenticatedPaths: string[] = ["/oauth/consent"];
