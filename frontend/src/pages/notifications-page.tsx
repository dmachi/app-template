import { useEffect, useState } from "react";

import { Button } from "../components/ui/button";
import {
  acknowledgeNotification,
  checkNotificationCompletion,
  clearNotification,
  listMyNotifications,
  markNotificationRead,
  type NotificationItem,
} from "../lib/api";

type NotificationsPageProps = {
  accessToken: string;
  refreshSignal?: number;
};

export function NotificationsPage({ accessToken, refreshSignal = 0 }: NotificationsPageProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function loadNotifications() {
    setLoading(true);
    try {
      const payload = await listMyNotifications(accessToken);
      setNotifications(payload.items);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications().catch(() => {});
  }, [accessToken, refreshSignal]);

  async function onRead(notificationId: string) {
    setMessage(null);
    try {
      await markNotificationRead(accessToken, notificationId);
      await loadNotifications();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to mark as read");
    }
  }

  async function onAcknowledge(notificationId: string) {
    setMessage(null);
    try {
      await acknowledgeNotification(accessToken, notificationId);
      await loadNotifications();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to acknowledge notification");
    }
  }

  async function onCheckCompletion(notificationId: string) {
    setMessage(null);
    try {
      const result = await checkNotificationCompletion(accessToken, notificationId);
      setMessage(result.completed ? "Completion check passed." : "Completion check did not pass yet.");
      await loadNotifications();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to check completion");
    }
  }

  async function onClear(notificationId: string) {
    setMessage(null);
    try {
      await clearNotification(accessToken, notificationId);
      await loadNotifications();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to clear notification");
    }
  }

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Notifications</h2>
        <Button type="button" onClick={() => loadNotifications()}>
          Refresh
        </Button>
      </div>

      {loading ? <p className="text-sm">Loading notifications...</p> : null}
      {!loading && notifications.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No notifications.</p> : null}

      <div className="grid gap-2">
        {notifications.map((notification) => (
          <div key={notification.id} className="rounded border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{notification.message}</p>
              <span className="text-xs text-slate-500 dark:text-slate-400">{notification.status}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {notification.type} · {new Date(notification.createdAt).toLocaleString()}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {notification.status === "unread" ? (
                <Button type="button" onClick={() => onRead(notification.id)}>
                  Mark Read
                </Button>
              ) : null}
              {notification.clearanceMode === "ack" && !notification.acknowledgedAt ? (
                <Button type="button" onClick={() => onAcknowledge(notification.id)}>
                  Acknowledge
                </Button>
              ) : null}
              {notification.clearanceMode === "task_gate" ? (
                <Button type="button" onClick={() => onCheckCompletion(notification.id)}>
                  Check Completion
                </Button>
              ) : null}
              {notification.status !== "cleared" ? (
                <Button type="button" onClick={() => onClear(notification.id)}>
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {message ? <p className="text-sm">{message}</p> : null}
    </section>
  );
}
