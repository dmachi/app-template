import { Dispatch, SetStateAction, useEffect } from "react";

import type { RealtimeNotificationToast } from "./use-app-toast-actions";

type UseRealtimeNotificationsParams = {
  accessToken: string | null;
  locationPathname: string;
  apiBase: string;
  setRealtimePopups: Dispatch<SetStateAction<RealtimeNotificationToast[]>>;
  setNotificationRefreshSignal: Dispatch<SetStateAction<number>>;
};

export function useRealtimeNotifications(params: UseRealtimeNotificationsParams) {
  const { accessToken, locationPathname, apiBase, setRealtimePopups, setNotificationRefreshSignal } = params;

  useEffect(() => {
    if (!accessToken) {
      setRealtimePopups([]);
      return;
    }

    const wsBase = apiBase.replace(/^http/i, "ws");
    const socket = new WebSocket(`${wsBase}/ws/events?token=${encodeURIComponent(accessToken)}`);
    const timers = new Map<string, number>();

    socket.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data) as {
          eventType?: string;
          payload?: {
            id?: string;
            message?: string;
            severity?: string;
            clearanceMode?: string;
            requiresAcknowledgement?: boolean;
            openEndpoint?: string | null;
          };
        };
        if (envelope.eventType !== "notification.created" && envelope.eventType !== "notification.updated") {
          return;
        }

        const payload = envelope.payload;
        if (!payload?.id || !payload.message) {
          return;
        }

        const severity: RealtimeNotificationToast["severity"] =
          payload.severity === "success" || payload.severity === "warning" || payload.severity === "error" ? payload.severity : "info";
        const popupId = payload.id;
        setNotificationRefreshSignal((current) => current + 1);

        if (locationPathname !== "/") {
          setRealtimePopups((current) => {
            const withoutSame = current.filter((item) => item.id !== popupId);
            return [
              {
                id: popupId,
                message: payload.message as string,
                severity,
                clearanceMode: payload.clearanceMode ?? "manual",
                requiresAcknowledgement: Boolean(payload.requiresAcknowledgement),
                openEndpoint: payload.openEndpoint ?? null,
                open: true,
              },
              ...withoutSame,
            ].slice(0, 3);
          });
        }

        const actionable = (payload.clearanceMode === "ack" && Boolean(payload.requiresAcknowledgement)) || payload.clearanceMode === "task_gate";
        if (!actionable) {
          const existingTimer = timers.get(popupId);
          if (typeof existingTimer === "number") {
            window.clearTimeout(existingTimer);
          }
          const timerId = window.setTimeout(() => {
            setRealtimePopups((current) => current.map((item) => (item.id === popupId ? { ...item, open: false } : item)));
            timers.delete(popupId);
          }, 5000);
          timers.set(popupId, timerId);
        }
      } catch {
        return;
      }
    };

    return () => {
      for (const timerId of timers.values()) {
        window.clearTimeout(timerId);
      }
      socket.close();
    };
  }, [accessToken, apiBase, locationPathname, setNotificationRefreshSignal, setRealtimePopups]);
}
