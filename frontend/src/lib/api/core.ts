export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthProviderMeta = {
  id: string;
  displayName: string;
  type: string;
};

export type AuthProvidersResponse = {
  appName: string;
  appIcon: string;
  localRegistrationEnabled: boolean;
  profilePropertyCatalog: ProfilePropertyCatalogItem[];
  providers: AuthProviderMeta[];
};

export type ProfilePropertyValueType = "text" | "url" | "boolean" | "links";

export type ProfilePropertyLinkItem = {
  label: string;
  url: string;
};

export type ProfilePropertyCatalogItem = {
  key: string;
  label: string;
  description: string;
  valueType: ProfilePropertyValueType;
  required?: boolean;
  placeholder?: string;
  allowedHosts?: string[];
  maxItems?: number;
};

export type MyProfileResponse = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  status: string;
  emailVerified: boolean;
  roles: string[];
  roleSources?: {
    direct: string[];
    inherited: Array<{ name: string; groups: string[] }>;
  };
  preferences: Record<string, unknown>;
  profileProperties: Record<string, unknown>;
  profilePropertyCatalog: ProfilePropertyCatalogItem[];
};

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";

export async function parseJson(response: Response): Promise<any> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message ?? "Request failed";
    throw new Error(message);
  }
  return payload;
}

export type RegisterResponse = {
  id: string;
  email: string;
  status: string;
  emailVerified: boolean;
  accessToken?: string;
  refreshToken?: string;
};

export type AdminCapabilities = {
  anyAdmin: boolean;
  users: boolean;
  groups: boolean;
  invitations: boolean;
  roles: boolean;
  content?: boolean;
  contentTypes?: boolean;
  agentsManageAll?: boolean;
  agentsDevelop?: boolean;
  effectiveRoles: string[];
};

export type AgentItem = {
  id: string;
  key: string;
  agentType: "builtin" | "custom";
  name: string;
  description: string | null;
  instructions: string;
  model: string | null;
  temperature: number | null;
  llmConfigName: string | null;
  resolvedLlmConfigName: string | null;
  tools: string[];
  metadata: Record<string, unknown>;
  ownerUserId: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
  canUse: boolean;
  canEdit: boolean;
  canManageAccess: boolean;
};

export type AgentGrantItem = {
  id: string;
  agentId: string;
  subjectType: "user" | "group" | "project";
  subjectId: string;
  accessLevel: "use" | "edit";
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type CmsFieldType =
  | "text"
  | "textarea"
  | "markdown"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "select"
  | "multiselect"
  | "url"
  | "link"
  | "links"
  | "imageRef"
  | "imageRefs";

export type CmsFieldDefinitionOption = {
  label?: string;
  value: string | number | boolean;
};

export type CmsFieldDefinition = {
  key: string;
  label: string;
  description?: string | null;
  type: CmsFieldType | string;
  required?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  helpText?: string;
  options?: Array<CmsFieldDefinitionOption | string | number | boolean>;
  validation?: Record<string, unknown>;
};

export type CmsContentType = {
  key: string;
  label: string;
  description: string | null;
  status: string;
  fieldDefinitions: CmsFieldDefinition[];
  permissionsPolicy: Record<string, unknown>;
  systemManaged: boolean;
  fieldOrder: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type CmsContentItem = {
  id: string;
  contentTypeKey: string;
  name: string;
  content: string;
  additionalFields: Record<string, unknown>;
  status: string;
  visibility: string;
  allowedRoles: string[];
  layoutKey: string | null;
  linkRefs: Record<string, unknown>[];
  createdByUserId: string;
  updatedByUserId: string;
  publishedAt: string | null;
  publishedByUserId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CmsByIdResponse = {
  content: CmsContentItem;
  canonicalUrl: string;
  visibility: string;
  preview: boolean;
};

export type MediaImageItem = {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  uploadedByUserId: string;
  createdAt: string | null;
  updatedAt: string | null;
  altText: string | null;
  title: string | null;
  tags: string[];
};

export type NotificationItem = {
  id: string;
  userId: string;
  type: string;
  message: string;
  severity: string;
  requiresAcknowledgement: boolean;
  clearanceMode: string;
  source: Record<string, unknown>;
  openEndpoint: string | null;
  deliveryOptions: Record<string, unknown>;
  completionCheck: Record<string, unknown> | null;
  status: string;
  mergeCount: number;
  readAt: string | null;
  acknowledgedAt: string | null;
  clearedAt: string | null;
  canceledAt: string | null;
  completionSatisfiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserListItem = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  status: string;
  roles: string[];
};

export type AdminUserDetail = AdminUserListItem & {
  emailNormalized: string;
  emailVerified: boolean;
  preferences: Record<string, unknown>;
  profileProperties: Record<string, unknown>;
  profilePropertyCatalog: ProfilePropertyCatalogItem[];
  createdAt: string;
  updatedAt: string;
};

export type AdminUserGroupMembership = {
  id: string;
  name: string;
  description: string | null;
  roles: string[];
  ownerUserId: string;
  ownerDisplayName: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
};

export type AdminOutstandingInvitation = {
  id: string;
  invitedEmail: string;
  invitedByUserId: string;
  invitedByDisplayName: string | null;
  groupIds: string[];
  groupNames: string[];
  createdAt: string;
  expiresAt: string;
};

export type AdminRoleItem = {
  name: string;
  description?: string | null;
};

export type ProjectLink = {
  label: string;
  url: string;
  linkType: string;
  isPublic: boolean;
};

export type ProjectItem = {
  id: string;
  name: string;
  shortName: string | null;
  summary: string | null;
  status: string;
  visibility: "public" | "private";
  startDate: string;
  endDate: string | null;
  tags: string[];
  links: ProjectLink[];
  metadata: Record<string, unknown>;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectMemberItem = {
  id: string;
  projectId: string;
  userId: string;
  userDisplayName?: string | null;
  username?: string | null;
  email?: string | null;
  projectRole: string;
  notes: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type AwardItem = {
  id: string;
  projectId: string;
  sponsorId: string;
  awardType: string;
  title: string | null;
  awardIdentifier: string;
  startDate: string;
  endDate: string;
  amount: number;
  description: string | null;
  notes: string | null;
  link: string | null;
  isPublic: boolean;
  isAmountPublic: boolean;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicProjectItem = {
  id: string;
  name: string;
  shortName: string | null;
  summary: string | null;
  status: string;
  startDate: string;
  endDate: string | null;
  tags: string[];
  links: ProjectLink[];
  awards?: PublicAwardItem[];
};

export type PublicAwardItem = {
  id: string;
  awardType: string;
  title: string | null;
  awardIdentifier: string;
  startDate: string;
  endDate: string;
  description: string | null;
  link: string | null;
  amount?: number;
};

export type SponsorItem = {
  id: string;
  name: string;
  alias: string | null;
  acronym: string | null;
  description: string | null;
  link: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type JobRunItem = {
  id: string;
  taskDefinitionId: string;
  taskType: string;
  status: string;
  requestedByUserId: string;
  currentAttempt: number;
  maxRerunsEffective: number;
  input: Record<string, unknown>;
  isArchived: boolean;
  archivedAt: string | null;
  celeryTaskId: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  cancelRequestedAt: string | null;
  cancelRequestedByUserId: string | null;
  progressPercent: number;
  metadata: {
    progressPercent: number;
  };
  output: Record<string, unknown>;
  lastError: Record<string, unknown> | null;
};

export type JobTaskDefinitionItem = {
  id: string;
  taskType: string;
  celeryTaskName: string;
  enabled: boolean;
  defaultMaxReruns: number | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type LlmProviderPresetItem = {
  id: string;
  endpoints: string[];
};

export type LlmCredentialSetItem = {
  id: string;
  name: string;
  provider: string;
  secretMasked: string;
  active: boolean;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type LlmConfigItem = {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  credentialSetId: string;
  model: string;
  enabled: boolean;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type LlmGlobalSettingsItem = {
  defaultConfigName: string | null;
  taskMappings: Record<string, string>;
};

export type LlmProjectOverrideItem = {
  projectId: string;
  defaultConfigName: string | null;
  mappings: Record<string, string>;
  updatedByUserId: string;
  updatedAt: string;
};

export type MyJobStatusCounts = {
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  cancelRequested: number;
  canceled: number;
};
