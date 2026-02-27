import { useEffect, useState } from "react";

import { Button } from "../components/ui/button";
import {
  adminCancelNotification,
  adminDeleteNotification,
  adminListNotifications,
  adminResendNotification,
  type NotificationItem,
} from "../lib/api";

type AdminNotificationsPageProps = {
  accessToken: string;
};

export function AdminNotificationsPage({ accessToken }: AdminNotificationsPageProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function loadNotifications() {
    setLoading(true);
    try {
      const payload = await adminListNotifications(accessToken);
      setItems(payload.items);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications().catch(() => {});
  }, [accessToken]);

  async function onResend(notificationId: string) {
    setMessage(null);
    try {
      await adminResendNotification(accessToken, notificationId);
      setMessage("Notification redelivery triggered.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to resend notification");
    }
  }

  async function onCancel(notificationId: string) {
    setMessage(null);
    try {
      await adminCancelNotification(accessToken, notificationId);
      await loadNotifications();
      setMessage("Notification canceled.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to cancel notification");
    }
  }

  async function onDelete(notificationId: string) {
    setMessage(null);
    try {
      await adminDeleteNotification(accessToken, notificationId);
      await loadNotifications();
      setMessage("Notification deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete notification");
    }
  }

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Admin Notifications</h2>
        <Button type="button" onClick={() => loadNotifications()}>
          Refresh
        </Button>
      </div>

      {loading ? <p className="text-sm">Loading notifications...</p> : null}
      {!loading && items.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No notifications found.</p> : null}

      <div className="grid gap-2">
        {items.map((item) => (
          <div key={item.id} className="rounded border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{item.message}</p>
              <span className="text-xs text-slate-500 dark:text-slate-400">{item.status}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              recipient: {item.userId} · {item.type}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" onClick={() => onResend(item.id)}>
                Resend
              </Button>
              <Button type="button" onClick={() => onCancel(item.id)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => onDelete(item.id)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {message ? <p className="text-sm">{message}</p> : null}
    </section>
  );
}
