import { Dispatch, SetStateAction, useCallback } from "react";

import { acknowledgeNotification, markNotificationRead } from "../../lib/api";

export type RealtimeNotificationToast = {
  id: string;
  message: string;
  severity: "info" | "success" | "warning" | "error";
  clearanceMode: string;
  requiresAcknowledgement: boolean;
  openEndpoint: string | null;
  open: boolean;
};

export type ClientPopupToast = {
  id: string;
  title: string;
  message: string;
  severity: "info" | "success" | "warning" | "error";
  open: boolean;
};

export function isActionRequiredToast(toast: RealtimeNotificationToast): boolean {
  return (toast.clearanceMode === "ack" && toast.requiresAcknowledgement) || toast.clearanceMode === "task_gate";
}

type UseAppToastActionsParams = {
  accessToken: string | null;
  navigateTo: (to: string, replace?: boolean) => void;
  setRealtimePopups: Dispatch<SetStateAction<RealtimeNotificationToast[]>>;
  setClientPopups: Dispatch<SetStateAction<ClientPopupToast[]>>;
  setNotificationRefreshSignal: Dispatch<SetStateAction<number>>;
};

type UseAppToastActionsResult = {
  removeToast: (toastId: string) => void;
  removeClientToast: (toastId: string) => void;
  onToastManualClose: (toastId: string) => Promise<void>;
  onToastAcknowledge: (toastId: string) => Promise<void>;
  onToastOpenTask: (toast: RealtimeNotificationToast) => Promise<void>;
};

export function useAppToastActions(params: UseAppToastActionsParams): UseAppToastActionsResult {
  const { accessToken, navigateTo, setRealtimePopups, setClientPopups, setNotificationRefreshSignal } = params;

  const removeToast = useCallback((toastId: string) => {
    setRealtimePopups((current) => current.filter((item) => item.id !== toastId));
  }, [setRealtimePopups]);

  const removeClientToast = useCallback((toastId: string) => {
    setClientPopups((current) => current.filter((item) => item.id !== toastId));
  }, [setClientPopups]);

  const onToastManualClose = useCallback(async (toastId: string) => {
    if (accessToken) {
      try {
        await markNotificationRead(accessToken, toastId);
      } catch {
        // ignore read-mark failures for temporary notification UI behavior
      }
      setNotificationRefreshSignal((current) => current + 1);
    }
    removeToast(toastId);
  }, [accessToken, removeToast, setNotificationRefreshSignal]);

  const onToastAcknowledge = useCallback(async (toastId: string) => {
    if (!accessToken) {
      removeToast(toastId);
      return;
    }
    try {
      await acknowledgeNotification(accessToken, toastId);
    } catch {
      // ignore ack failures for temporary notification UI behavior
    }
    setNotificationRefreshSignal((current) => current + 1);
    removeToast(toastId);
  }, [accessToken, removeToast, setNotificationRefreshSignal]);

  const onToastOpenTask = useCallback(async (toast: RealtimeNotificationToast) => {
    if (accessToken) {
      try {
        await markNotificationRead(accessToken, toast.id);
      } catch {
        // ignore read-mark failures before navigation
      }
      setNotificationRefreshSignal((current) => current + 1);
    }
    removeToast(toast.id);
    if (toast.openEndpoint) {
      window.location.assign(toast.openEndpoint);
      return;
    }
    navigateTo("/settings/notifications");
  }, [accessToken, navigateTo, removeToast, setNotificationRefreshSignal]);

  return {
    removeToast,
    removeClientToast,
    onToastManualClose,
    onToastAcknowledge,
    onToastOpenTask,
  };
}
