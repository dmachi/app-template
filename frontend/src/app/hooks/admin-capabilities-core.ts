import type { AdminCapabilities as ApiAdminCapabilities } from "../../lib/api";
import {
  adminCapabilitiesDefaultsOverride,
  mapApiAdminCapabilitiesOverride,
} from "../../extensions/app-hooks/admin-capabilities";
import type { AdminCapabilities } from "./types";

const BASE_EMPTY_ADMIN_CAPABILITIES: AdminCapabilities = {
  users: false,
  groups: false,
  invitations: false,
  roles: false,
  content: false,
  contentTypes: false,
};

export function getEmptyAdminCapabilities(): AdminCapabilities {
  return {
    ...BASE_EMPTY_ADMIN_CAPABILITIES,
    ...(adminCapabilitiesDefaultsOverride || {}),
  };
}

export function mapApiAdminCapabilitiesToApp(capabilities: ApiAdminCapabilities): AdminCapabilities {
  const baseMapped: AdminCapabilities = {
    users: capabilities.users,
    groups: capabilities.groups,
    invitations: capabilities.invitations,
    roles: capabilities.roles,
    content: Boolean(capabilities.content),
    contentTypes: Boolean(capabilities.contentTypes),
  };

  const override = mapApiAdminCapabilitiesOverride ? mapApiAdminCapabilitiesOverride(capabilities) : null;
  if (!override) {
    return baseMapped;
  }

  return {
    ...baseMapped,
    ...override,
  };
}
