import { Button } from "../ui/button";
import { NotificationItem } from "../../lib/api";

export type AuthenticatedHomeContentProps = {
  currentUsername: string;
  homeNotifications: NotificationItem[];
  onAcknowledge: (notificationId: string) => void;
  onOpenTask: (notification: NotificationItem) => void;
  onGoToSettings: () => void;
};

export function AuthenticatedHomeContent(props: AuthenticatedHomeContentProps) {
  return (
    <main className="w-full px-6 py-6">
      {props.homeNotifications.length > 0 ? (
        <section className="mb-4 grid gap-2">
          {props.homeNotifications.map((notification) => (
            <div key={notification.id} className="rounded-md border border-slate-200 px-4 py-3 text-sm dark:border-slate-700">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{notification.message}</p>
                <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{notification.clearanceMode}</span>
              </div>
              <div className="mt-2 flex gap-2">
                {notification.clearanceMode === "ack" && !notification.acknowledgedAt ? (
                  <Button type="button" onClick={() => props.onAcknowledge(notification.id)}>
                    Acknowledge
                  </Button>
                ) : null}
                {notification.clearanceMode === "task_gate" ? (
                  <Button type="button" onClick={() => props.onOpenTask(notification)}>
                    Open Task
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </section>
      ) : null}
      <section className="rounded-md border border-slate-200 p-6 dark:border-slate-800">
        <h2 className="mb-2 text-xl font-semibold">Welcome, {props.currentUsername}</h2>
        <h2 className="mb-3 text-2xl font-semibold">Home</h2>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc sit amet ante nec nulla faucibus tempus.
          Fusce eget lacus at sapien faucibus malesuada et vitae justo.
        </p>
        <div className="mt-4">
          <Button type="button" onClick={props.onGoToSettings}>
            Go to Settings
          </Button>
        </div>
      </section>
    </main>
  );
}
