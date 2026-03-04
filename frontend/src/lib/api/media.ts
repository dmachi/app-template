import { API_BASE, parseJson } from "./core";
import type { MediaImageItem } from "./core";

export {
  type MediaImageItem,
} from "./core";

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
