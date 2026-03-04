import { API_BASE, parseJson } from "./core";
import type {
  CmsByIdResponse,
  CmsContentItem,
  CmsContentType,
  CmsFieldDefinition,
} from "./core";

export {
  type CmsFieldType,
  type CmsFieldDefinitionOption,
  type CmsFieldDefinition,
  type CmsContentType,
  type CmsContentItem,
  type CmsByIdResponse,
} from "./core";

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

export async function getPublicCmsContentById(
  contentTypeKey: string,
  contentId: string,
  accessToken?: string | null,
): Promise<CmsByIdResponse> {
  return parseJson(
    await fetch(`${API_BASE}/cms/${encodeURIComponent(contentTypeKey)}/${encodeURIComponent(contentId)}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    }),
  );
}
