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
    const socketUrl = `${wsBase}/ws/events?token=${encodeURIComponent(accessToken)}`;
    const timers = new Map<string, number>();
    let socket: WebSocket | null = null;
    let reconnectAttempts = 0;
    let reconnectTimer: number | null = null;
    let disposed = false;
    let intentionalClose = false;

    const clearReconnectTimer = () => {
      if (typeof reconnectTimer === "number") {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (disposed || typeof reconnectTimer === "number") {
        return;
      }
      const delay = Math.min(5000, 500 * (2 ** reconnectAttempts));
      reconnectAttempts += 1;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    const handleMessage = (event: MessageEvent) => {
      try {
        const envelope = JSON.parse(event.data) as {
          eventType?: string;
          event_type?: string;
          payload?: {
            id?: string;
            message?: string;
            severity?: string;
            clearanceMode?: string;
            requiresAcknowledgement?: boolean;
            openEndpoint?: string | null;
          };
        };
        const eventType = envelope.eventType ?? envelope.event_type;
        if (eventType?.startsWith("job.run.")) {
          window.dispatchEvent(new CustomEvent("jobs:updated", { detail: envelope }));
          return;
        }
        if (eventType !== "notification.created" && eventType !== "notification.updated") {
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

    const connect = () => {
      if (disposed) {
        return;
      }

      intentionalClose = false;
      socket = new WebSocket(socketUrl);
      socket.onopen = () => {
        reconnectAttempts = 0;
        clearReconnectTimer();
      };
      socket.onmessage = handleMessage;
      socket.onerror = () => {
        if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      };
      socket.onclose = () => {
        if (!intentionalClose) {
          scheduleReconnect();
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      clearReconnectTimer();

      for (const timerId of timers.values()) {
        window.clearTimeout(timerId);
      }

      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        intentionalClose = true;
        socket.close(1000, "Unmounted");
      }
    };
  }, [accessToken, apiBase, locationPathname, setNotificationRefreshSignal, setRealtimePopups]);
}
