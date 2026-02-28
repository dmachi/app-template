import { useState } from "react";

import { useClientToastListener } from "./use-app-bootstrap";
import type { ClientPopupToast, RealtimeNotificationToast } from "./use-app-toast-actions";

export function useAppNotificationState() {
  const [realtimePopups, setRealtimePopups] = useState<RealtimeNotificationToast[]>([]);
  const [clientPopups, setClientPopups] = useState<ClientPopupToast[]>([]);
  const [notificationRefreshSignal, setNotificationRefreshSignal] = useState(0);

  useClientToastListener(setClientPopups);

  return {
    realtimePopups,
    setRealtimePopups,
    clientPopups,
    setClientPopups,
    notificationRefreshSignal,
    setNotificationRefreshSignal,
  };
}