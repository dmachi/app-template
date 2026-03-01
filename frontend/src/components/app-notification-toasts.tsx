import { Button } from "./ui/button";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "./ui/toast";
import type { ClientPopupToast, RealtimeNotificationToast } from "../app/hooks/use-app-toast-actions";

type AppNotificationToastsProps = {
  realtimePopups: RealtimeNotificationToast[];
  clientPopups: ClientPopupToast[];
  isActionRequiredToast: (toast: RealtimeNotificationToast) => boolean;
  onRemoveToast: (toastId: string) => void;
  onToastManualClose: (toastId: string) => void;
  onToastAcknowledge: (toastId: string) => void;
  onToastOpenTask: (toast: RealtimeNotificationToast) => void;
  onRemoveClientToast: (toastId: string) => void;
};

function getToastClassName(severity: "info" | "success" | "warning" | "error"): string {
  if (severity === "error") {
    return "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200";
  }
  if (severity === "warning") {
    return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200";
  }
  if (severity === "success") {
    return "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200";
  }
  return "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200";
}

export function AppNotificationToasts(props: AppNotificationToastsProps) {
  return (
    <ToastProvider>
      {props.realtimePopups.map((popup) => (
        <Toast
          key={popup.id}
          open={popup.open}
          duration={props.isActionRequiredToast(popup) ? 86_400_000 : 5000}
          onOpenChange={(open) => {
            if (!open) {
              props.onRemoveToast(popup.id);
            }
          }}
          className={getToastClassName(popup.severity)}
        >
          <div className="grid gap-1">
            <ToastTitle>Notification</ToastTitle>
            <ToastDescription>{popup.message}</ToastDescription>
            <div className="mt-2 flex flex-wrap gap-2">
              {popup.requiresAcknowledgement && popup.clearanceMode === "ack" ? (
                <Button type="button" onClick={() => props.onToastAcknowledge(popup.id)}>
                  Acknowledge
                </Button>
              ) : null}
              {popup.clearanceMode === "task_gate" ? (
                <Button type="button" onClick={() => props.onToastOpenTask(popup)}>
                  Open Task
                </Button>
              ) : null}
            </div>
          </div>
          <ToastClose aria-label="Close" onClick={() => props.onToastManualClose(popup.id)} />
        </Toast>
      ))}
      {props.clientPopups.map((popup) => (
        <Toast
          key={popup.id}
          open={popup.open}
          duration={4000}
          onOpenChange={(open) => {
            if (!open) {
              props.onRemoveClientToast(popup.id);
            }
          }}
          className={getToastClassName(popup.severity)}
        >
          <div className="grid gap-1">
            <ToastTitle>{popup.title}</ToastTitle>
            <ToastDescription>{popup.message}</ToastDescription>
          </div>
          <ToastClose aria-label="Close" onClick={() => props.onRemoveClientToast(popup.id)} />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
