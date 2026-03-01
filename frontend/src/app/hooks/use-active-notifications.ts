import { useCallback, useEffect, useState } from "react";

import { acknowledgeNotification, listMyNotifications, type NotificationItem } from "../../lib/api";

export function toActiveNotifications(items: NotificationItem[]): NotificationItem[] {
  return items.filter((notification) => {
    if (notification.status === "cleared" || notification.canceledAt) {
      return false;
    }
    if (notification.clearanceMode === "ack") {
      return !notification.acknowledgedAt;
    }
    return notification.clearanceMode === "task_gate";
  });
}

type UseActiveNotificationsParams = {
  accessToken: string | null;
  navigateTo: (to: string, replace?: boolean) => void;
  notificationRefreshSignal?: number;
};

export function useActiveNotifications(params: UseActiveNotificationsParams) {
  const { accessToken, navigateTo, notificationRefreshSignal } = params;
  const [activeNotifications, setActiveNotifications] = useState<NotificationItem[]>([]);

  const refreshActiveNotifications = useCallback(async (tokenOverride?: string) => {
    const token = tokenOverride ?? accessToken;
    if (!token) {
      setActiveNotifications([]);
      return;
    }
    const payload = await listMyNotifications(token);
    setActiveNotifications(toActiveNotifications(payload.items));
  }, [accessToken]);

  const acknowledgeActiveNotification = useCallback(async (notificationId: string) => {
    if (!accessToken) {
      return;
    }
    try {
      await acknowledgeNotification(accessToken, notificationId);
      await refreshActiveNotifications(accessToken);
    } catch {
      return;
    }
  }, [accessToken, refreshActiveNotifications]);

  const openNotificationTask = useCallback((notification: NotificationItem) => {
    if (notification.openEndpoint) {
      window.location.assign(notification.openEndpoint);
      return;
    }
    navigateTo("/settings/notifications");
  }, [navigateTo]);

  useEffect(() => {
    void refreshActiveNotifications();
  }, [refreshActiveNotifications]);

  useEffect(() => {
    if (!accessToken || notificationRefreshSignal === undefined) {
      return;
    }
    void refreshActiveNotifications(accessToken);
  }, [accessToken, notificationRefreshSignal, refreshActiveNotifications]);

  return {
    activeNotifications,
    setActiveNotifications,
    refreshActiveNotifications,
    acknowledgeActiveNotification,
    openNotificationTask,
  };
}
