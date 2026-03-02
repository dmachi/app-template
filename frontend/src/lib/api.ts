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

async function parseJson(response: Response): Promise<any> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message ?? "Request failed";
    throw new Error(message);
  }
  return payload;
}

export async function login(usernameOrEmail: string, password: string): Promise<AuthTokens> {
  return parseJson(
    await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernameOrEmail, password }),
    }),
  );
}

export type RegisterResponse = {
  id: string;
  email: string;
  status: string;
  emailVerified: boolean;
  accessToken?: string;
  refreshToken?: string;
};

export async function register(
  username: string,
  email: string,
  password: string,
  displayName?: string,
  profileProperties?: Record<string, unknown>,
): Promise<RegisterResponse> {
  return parseJson(
    await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, displayName, profileProperties }),
    }),
  );
}

export async function getAuthProviders(): Promise<AuthProvidersResponse> {
  return parseJson(await fetch(`${API_BASE}/meta/auth-providers`));
}

export async function startRedirectProvider(providerId: string): Promise<{ provider: string; mode: string; redirectUrl?: string | null }> {
  return parseJson(await fetch(`${API_BASE}/auth/${providerId}/start`));
}

export async function verifyEmail(token: string): Promise<{ success: boolean; status: string; emailVerified: boolean }> {
  const params = new URLSearchParams({ token });
  return parseJson(await fetch(`${API_BASE}/auth/verify-email?${params.toString()}`));
}

export async function getInvitation(token: string): Promise<{ valid: boolean; invitedEmail: string; groupIds: string[]; expiresAt: string }> {
  return parseJson(await fetch(`${API_BASE}/auth/invitations/${encodeURIComponent(token)}`));
}

export async function acceptInvitation(accessToken: string, token: string): Promise<{ success: boolean; groupIds: string[]; acceptedByUserId: string }> {
  return parseJson(
    await fetch(`${API_BASE}/auth/invitations/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ token }),
    }),
  );
}

export async function refreshSession(refreshToken: string): Promise<AuthTokens> {
  return parseJson(
    await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }),
  );
}

export async function logout(refreshToken: string): Promise<{ success: boolean }> {
  return parseJson(
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }),
  );
}

export async function getMyProfile(accessToken: string): Promise<MyProfileResponse> {
  return parseJson(
    await fetch(`${API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function searchUsers(accessToken: string, query: string, limit = 10): Promise<{ items: any[] }> {
  const params = new URLSearchParams({ query, limit: String(limit) });
  return parseJson(
    await fetch(`${API_BASE}/users/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function patchMyProfile(
  accessToken: string,
  body: { displayName?: string; email?: string; preferences?: Record<string, unknown>; profileProperties?: Record<string, unknown> },
): Promise<MyProfileResponse> {
  return parseJson(
    await fetch(`${API_BASE}/users/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

export async function resendMyVerificationEmail(accessToken: string): Promise<{ success: boolean; sent: boolean; message: string }> {
  return parseJson(
    await fetch(`${API_BASE}/users/me/resend-verification`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function getUserBasic(accessToken: string, userId: string): Promise<{ id: string; displayName: string }> {
  return parseJson(
    await fetch(`${API_BASE}/users/${userId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function listMyGroups(accessToken: string): Promise<{ items: any[] }> {
  return parseJson(
    await fetch(`${API_BASE}/groups`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function listMyGroupCollections(accessToken: string): Promise<{ owned: any[]; memberOf: any[] }> {
  return parseJson(
    await fetch(`${API_BASE}/groups/mine`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function getGroup(accessToken: string, groupId: string): Promise<any> {
  return parseJson(
    await fetch(`${API_BASE}/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function listGroupMembers(accessToken: string, groupId: string): Promise<{ items: any[] }> {
  return parseJson(
    await fetch(`${API_BASE}/groups/${groupId}/members`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function addGroupMember(accessToken: string, groupId: string, usernameOrEmail: string): Promise<{ success: boolean }> {
  return parseJson(
    await fetch(`${API_BASE}/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ usernameOrEmail }),
    }),
  );
}

export async function removeGroupMember(accessToken: string, groupId: string, userId: string): Promise<{ success: boolean }> {
  return parseJson(
    await fetch(`${API_BASE}/groups/${groupId}/members/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function createGroup(accessToken: string, body: { name: string; description?: string }): Promise<any> {
  return parseJson(
    await fetch(`${API_BASE}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

export async function patchGroup(accessToken: string, groupId: string, body: { name?: string; description?: string }): Promise<any> {
  return parseJson(
    await fetch(`${API_BASE}/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteGroup(accessToken: string, groupId: string): Promise<{ success: boolean }> {
  return parseJson(
    await fetch(`${API_BASE}/groups/${groupId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function canAccessUserManagement(accessToken: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/auth/user-management-check`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.ok) {
    return true;
  }
  if (response.status === 401 || response.status === 403) {
    return false;
  }

  const payload = await response.json().catch(() => ({}));
  const message = payload?.error?.message ?? "Unable to verify admin access";
  throw new Error(message);
}

export type AdminCapabilities = {
  anyAdmin: boolean;
  users: boolean;
  groups: boolean;
  invitations: boolean;
  roles: boolean;
  content?: boolean;
  contentTypes?: boolean;
  effectiveRoles: string[];
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
  enableAlias: boolean;
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
  aliasPath: string | null;
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

export type CmsResolveResponse = {
  matched: boolean;
  content: CmsContentItem;
  canonicalUrl: string | null;
  visibility: string;
};

export type CmsByIdResponse = {
  content: CmsContentItem;
  canonicalUrl: string | null;
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

export async function getAdminCapabilities(accessToken: string): Promise<AdminCapabilities> {
  return parseJson(
    await fetch(`${API_BASE}/auth/admin-capabilities`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function listCmsContentTypes(): Promise<{ items: CmsContentType[] }> {
  return parseJson(await fetch(`${API_BASE}/content/types`));
}

export async function adminCreateCmsContentType(
  accessToken: string,
  body: {
    key: string;
    label: string;
    description?: string;
    fieldDefinitions?: CmsFieldDefinition[];
    permissionsPolicy?: Record<string, unknown>;
    enableAlias?: boolean;
    fieldOrder?: string[];
  },
): Promise<CmsContentType> {
  return parseJson(
    await fetch(`${API_BASE}/admin/content/types`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

export async function adminPatchCmsContentType(
  accessToken: string,
  key: string,
  body: {
    label?: string;
    description?: string | null;
    status?: string;
    fieldDefinitions?: CmsFieldDefinition[];
    permissionsPolicy?: Record<string, unknown>;
    enableAlias?: boolean;
    fieldOrder?: string[];
  },
): Promise<CmsContentType> {
  return parseJson(
    await fetch(`${API_BASE}/admin/content/types/${encodeURIComponent(key)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

export async function listCmsContent(accessToken: string): Promise<{ items: CmsContentItem[] }> {
  return parseJson(
    await fetch(`${API_BASE}/content`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function createCmsContent(
  accessToken: string,
  body: {
    contentTypeKey: string;
    name: string;
    content: string;
    additionalFields?: Record<string, unknown>;
    aliasPath?: string | null;
    visibility?: string;
    allowedRoles?: string[];
    layoutKey?: string | null;
    linkRefs?: Record<string, unknown>[];
  },
): Promise<CmsContentItem> {
  return parseJson(
    await fetch(`${API_BASE}/content`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

export async function getCmsContentById(accessToken: string, contentId: string): Promise<CmsContentItem> {
  return parseJson(
    await fetch(`${API_BASE}/content/${encodeURIComponent(contentId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function patchCmsContent(
  accessToken: string,
  contentId: string,
  body: {
    name?: string;
    content?: string;
    additionalFields?: Record<string, unknown>;
    aliasPath?: string | null;
    visibility?: string;
    allowedRoles?: string[];
    layoutKey?: string | null;
    linkRefs?: Record<string, unknown>[];
  },
): Promise<CmsContentItem> {
  return parseJson(
    await fetch(`${API_BASE}/content/${encodeURIComponent(contentId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

export async function publishCmsContent(accessToken: string, contentId: string): Promise<CmsContentItem> {
  return parseJson(
    await fetch(`${API_BASE}/content/${encodeURIComponent(contentId)}/publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function unpublishCmsContent(accessToken: string, contentId: string): Promise<CmsContentItem> {
  return parseJson(
    await fetch(`${API_BASE}/content/${encodeURIComponent(contentId)}/unpublish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function deleteCmsContent(accessToken: string, contentId: string): Promise<{ success: boolean }> {
  return parseJson(
    await fetch(`${API_BASE}/content/${encodeURIComponent(contentId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function getPublicCmsContentById(contentId: string, accessToken?: string | null): Promise<CmsByIdResponse> {
  return parseJson(
    await fetch(`${API_BASE}/cms/${encodeURIComponent(contentId)}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    }),
  );
}

export async function resolveCmsPath(path: string, accessToken?: string | null): Promise<CmsResolveResponse> {
  const params = new URLSearchParams({ path });
  return parseJson(
    await fetch(`${API_BASE}/cms/resolve?${params.toString()}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    }),
  );
}

export function getMediaImageUrl(mediaId: string): string {
  return `${API_BASE}/media/images/${encodeURIComponent(mediaId)}`;
}

export async function uploadMediaImage(accessToken: string, file: File): Promise<MediaImageItem> {
  const formData = new FormData();
  formData.append("file", file);

  return parseJson(
    await fetch(`${API_BASE}/media/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    }),
  );
}

export async function listMediaImages(accessToken: string): Promise<{ items: MediaImageItem[] }> {
  return parseJson(
    await fetch(`${API_BASE}/media/images`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function updateMediaImageMetadata(
  accessToken: string,
  mediaId: string,
  body: { altText?: string | null; title?: string | null; tags?: string[] },
): Promise<MediaImageItem> {
  return parseJson(
    await fetch(`${API_BASE}/media/images/${encodeURIComponent(mediaId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteMediaImage(accessToken: string, mediaId: string): Promise<{ success: boolean }> {
  return parseJson(
    await fetch(`${API_BASE}/media/images/${encodeURIComponent(mediaId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function createNotifications(
  accessToken: string,
  body: {
    userIds: string[];
    type: string;
    message: string;
    severity?: string;
    requiresAcknowledgement?: boolean;
    clearanceMode?: string;
    source?: Record<string, unknown>;
    openEndpoint?: string;
    deliveryOptions?: Record<string, unknown>;
    completionCheck?: Record<string, unknown>;
  },
): Promise<{ created: NotificationItem[]; merged: NotificationItem[] }> {
  return parseJson(
    await fetch(`${API_BASE}/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

export async function listMyNotifications(
  accessToken: string,
  params?: { status?: string; type?: string; unreadOnly?: boolean },
): Promise<{ items: NotificationItem[] }> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.type) query.set("type", params.type);
  if (params?.unreadOnly) query.set("unreadOnly", "true");
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return parseJson(
    await fetch(`${API_BASE}/notifications${suffix}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function markNotificationRead(accessToken: string, notificationId: string): Promise<NotificationItem> {
  return parseJson(
    await fetch(`${API_BASE}/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function acknowledgeNotification(accessToken: string, notificationId: string): Promise<NotificationItem> {
  return parseJson(
    await fetch(`${API_BASE}/notifications/${encodeURIComponent(notificationId)}/acknowledge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function checkNotificationCompletion(
  accessToken: string,
  notificationId: string,
): Promise<{ completed: boolean; notification: NotificationItem }> {
  return parseJson(
    await fetch(`${API_BASE}/notifications/${encodeURIComponent(notificationId)}/check-completion`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function clearNotification(accessToken: string, notificationId: string): Promise<NotificationItem> {
  return parseJson(
    await fetch(`${API_BASE}/notifications/${encodeURIComponent(notificationId)}/clear`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminListNotifications(
  accessToken: string,
  params?: { status?: string; type?: string; userId?: string },
): Promise<{ items: NotificationItem[] }> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.type) query.set("type", params.type);
  if (params?.userId) query.set("userId", params.userId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return parseJson(
    await fetch(`${API_BASE}/admin/notifications${suffix}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminResendNotification(accessToken: string, notificationId: string): Promise<{ success: boolean; notification: NotificationItem }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/notifications/${encodeURIComponent(notificationId)}/resend`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminCancelNotification(accessToken: string, notificationId: string): Promise<{ success: boolean; notification: NotificationItem }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/notifications/${encodeURIComponent(notificationId)}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminDeleteNotification(accessToken: string, notificationId: string): Promise<{ success: boolean }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/notifications/${encodeURIComponent(notificationId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export type AdminUserListItem = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  status: string;
  roles: string[];
};

export async function adminListUsers(accessToken: string): Promise<{ items: AdminUserListItem[] }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export type AdminUserDetail = AdminUserListItem & {
  emailNormalized: string;
  emailVerified: boolean;
  preferences: Record<string, unknown>;
  profileProperties: Record<string, unknown>;
  profilePropertyCatalog: ProfilePropertyCatalogItem[];
  createdAt: string;
  updatedAt: string;
};

export async function adminGetUser(accessToken: string, userId: string): Promise<AdminUserDetail> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminResetUserPassword(accessToken: string, userId: string): Promise<{ success: boolean; delivery: string; message: string }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users/${userId}/reset-password`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminResendUserVerificationEmail(
  accessToken: string,
  userId: string,
): Promise<{ success: boolean; sent: boolean; message: string }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users/${userId}/resend-verification`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

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

export async function adminListUserGroups(accessToken: string, userId: string): Promise<{ items: AdminUserGroupMembership[] }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users/${userId}/groups`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminPatchUser(
  accessToken: string,
  userId: string,
  body: {
    displayName?: string;
    email?: string;
    status?: string;
    roles?: string[];
    preferences?: Record<string, unknown>;
    profileProperties?: Record<string, unknown>;
  },
): Promise<any> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

export async function adminInviteUsers(
  accessToken: string,
  body: { emails: string[]; groupIds: string[] },
): Promise<{ invited: number; addedExisting: number; failures: { email: string; error: string }[] }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

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

export async function adminListOutstandingInvitations(accessToken: string): Promise<{ items: AdminOutstandingInvitation[] }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users/invitations`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminResendInvitation(accessToken: string, invitationId: string): Promise<{ success: boolean; invitation: AdminOutstandingInvitation }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users/invitations/${encodeURIComponent(invitationId)}/resend`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminCopyInvitationLink(
  accessToken: string,
  invitationId: string,
): Promise<{ success: boolean; invitation: AdminOutstandingInvitation; invitationLink: string }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users/invitations/${encodeURIComponent(invitationId)}/copy-link`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminRevokeInvitation(accessToken: string, invitationId: string): Promise<{ success: boolean }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/users/invitations/${encodeURIComponent(invitationId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export type AdminRoleItem = {
  name: string;
  description?: string | null;
};

export async function adminListRoles(accessToken: string): Promise<{ items: AdminRoleItem[] }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/roles`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminCreateRole(accessToken: string, name: string, description?: string): Promise<AdminRoleItem> {
  return parseJson(
    await fetch(`${API_BASE}/admin/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ name, description }),
    }),
  );
}

export async function adminPatchRole(accessToken: string, roleName: string, description?: string): Promise<AdminRoleItem> {
  return parseJson(
    await fetch(`${API_BASE}/admin/roles/${encodeURIComponent(roleName)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ description }),
    }),
  );
}

export async function adminDeleteRole(accessToken: string, roleName: string): Promise<{ success: boolean }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/roles/${encodeURIComponent(roleName)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminListGroups(accessToken: string): Promise<{ items: any[] }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/groups`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminListAssignableGroupRoles(accessToken: string): Promise<{ items: AdminRoleItem[] }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/groups/assignable-roles`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminPatchGroup(
  accessToken: string,
  groupId: string,
  body: { name?: string; description?: string },
): Promise<any> {
  return parseJson(
    await fetch(`${API_BASE}/admin/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  );
}

export async function adminDeleteGroup(accessToken: string, groupId: string): Promise<{ success: boolean }> {
  return parseJson(
    await fetch(`${API_BASE}/admin/groups/${groupId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
}

export async function adminAssignGroupRoles(accessToken: string, groupId: string, roles: string[]): Promise<any> {
  return parseJson(
    await fetch(`${API_BASE}/admin/groups/${groupId}/roles`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ roles }),
    }),
  );
}
