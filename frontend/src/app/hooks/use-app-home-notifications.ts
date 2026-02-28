import { Dispatch, SetStateAction, useCallback, useState } from "react";

import { acknowledgeNotification, listMyNotifications, type NotificationItem } from "../../lib/api";

type UseAppHomeNotificationsParams = {
  accessToken: string | null;
  navigateTo: (to: string, replace?: boolean) => void;
  setNotificationRefreshSignal: Dispatch<SetStateAction<number>>;
};

type UseAppHomeNotificationsResult = {
  homeNotifications: NotificationItem[];
  setHomeNotifications: Dispatch<SetStateAction<NotificationItem[]>>;
  refreshHomeNotifications: (token: string) => Promise<void>;
  onHomeAcknowledge: (notificationId: string) => Promise<void>;
  onOpenTask: (notification: NotificationItem) => void;
};

export function useAppHomeNotifications(params: UseAppHomeNotificationsParams): UseAppHomeNotificationsResult {
  const { accessToken, navigateTo, setNotificationRefreshSignal } = params;
  const [homeNotifications, setHomeNotifications] = useState<NotificationItem[]>([]);

  const refreshHomeNotifications = useCallback(async (token: string) => {
    const payload = await listMyNotifications(token);
    const actionable = payload.items.filter((notification) => {
      if (notification.status === "cleared" || notification.canceledAt) {
        return false;
      }
      if (notification.clearanceMode === "ack") {
        return !notification.acknowledgedAt;
      }
      return notification.clearanceMode === "task_gate";
    });
    setHomeNotifications(actionable);
  }, []);

  const onHomeAcknowledge = useCallback(async (notificationId: string) => {
    if (!accessToken) {
      return;
    }
    try {
      await acknowledgeNotification(accessToken, notificationId);
      await refreshHomeNotifications(accessToken);
      setNotificationRefreshSignal((current) => current + 1);
    } catch {
      return;
    }
  }, [accessToken, refreshHomeNotifications, setNotificationRefreshSignal]);

  const onOpenTask = useCallback((notification: NotificationItem) => {
    if (notification.openEndpoint) {
      window.location.assign(notification.openEndpoint);
      return;
    }
    navigateTo("/settings/notifications");
  }, [navigateTo]);

  return {
    homeNotifications,
    setHomeNotifications,
    refreshHomeNotifications,
    onHomeAcknowledge,
    onOpenTask,
  };
}
