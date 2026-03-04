import { API_BASE, parseJson } from "./core";
import type { NotificationItem } from "./core";

export {
  type NotificationItem,
} from "./core";

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
