import { useEffect, useState } from "react";

import { UserSearchCombobox } from "../../../components/shared/user-search-combobox";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { showClientToast } from "../../../lib/client-toast";
import {
  adminCancelNotification,
  adminListNotifications,
  adminResendNotification,
  createNotifications,
  type NotificationItem,
} from "../../../lib/api";

type AdminNotificationsPageProps = {
  accessToken: string;
};

export function AdminNotificationsPage({ accessToken }: AdminNotificationsPageProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<{ id: string; username: string; email: string; displayName: string } | null>(null);

  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<{ id: string; username: string; email: string; displayName: string } | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newSeverity, setNewSeverity] = useState("info");
  const [requireAcknowledgement, setRequireAcknowledgement] = useState(false);
  const [sending, setSending] = useState(false);

  async function loadNotifications() {
    if (!selectedUser) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const payload = await adminListNotifications(accessToken, { userId: selectedUser.id });
      const since = Date.now() - 24 * 60 * 60 * 1000;
      setItems(
        (payload.items || []).filter((item) => {
          const createdAt = Date.parse(item.createdAt);
          return !Number.isNaN(createdAt) && createdAt >= since;
        }),
      );
    } catch (error) {
      showClientToast({ title: "Notifications", message: error instanceof Error ? error.message : "Unable to load notifications", severity: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications().catch(() => {});
  }, [accessToken, selectedUser?.id]);

  async function onSendNotification() {
    if (!targetUser) {
      showClientToast({ title: "Notifications", message: "Select a target user.", severity: "warning" });
      return;
    }
    if (!newMessage.trim()) {
      showClientToast({ title: "Notifications", message: "Enter a notification message.", severity: "warning" });
      return;
    }

    setSending(true);
    try {
      await createNotifications(accessToken, {
        userIds: [targetUser.id],
        type: "admin",
        message: newMessage.trim(),
        severity: newSeverity,
        requiresAcknowledgement: requireAcknowledgement,
        clearanceMode: requireAcknowledgement ? "ack" : "manual",
      });
      setSendDialogOpen(false);
      setSelectedUser(targetUser);
      setNewMessage("");
      setRequireAcknowledgement(false);
      await loadNotifications();
      showClientToast({ title: "Notifications", message: "Notification sent.", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Notifications", message: error instanceof Error ? error.message : "Unable to send notification", severity: "error" });
    } finally {
      setSending(false);
    }
  }

  async function onResend(notificationId: string) {
    try {
      await adminResendNotification(accessToken, notificationId);
      await loadNotifications();
      showClientToast({ title: "Notifications", message: "Notification redelivery triggered.", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Notifications", message: error instanceof Error ? error.message : "Unable to resend notification", severity: "error" });
    }
  }

  async function onClear(notificationId: string) {
    try {
      await adminCancelNotification(accessToken, notificationId);
      await loadNotifications();
      showClientToast({ title: "Notifications", message: "Notification cleared.", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Notifications", message: error instanceof Error ? error.message : "Unable to clear notification", severity: "error" });
    }
  }

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Admin Notifications</h2>
        <div className="flex gap-2">
          <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button">Send Notification</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Notification</DialogTitle>
                <DialogDescription>Choose a target user and send a notification message.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-3">
                <div className="grid gap-1">
                  <span className="text-sm">Target User</span>
                  <UserSearchCombobox
                    accessToken={accessToken}
                    onSelect={setTargetUser}
                    placeholder={targetUser ? `${targetUser.displayName} (${targetUser.username})` : "Search and select user"}
                  />
                </div>

                <label className="grid gap-1">
                  <span className="text-sm">Message</span>
                  <textarea
                    className="min-h-[90px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    placeholder="Enter notification message"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-sm">Severity</span>
                  <select
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                    value={newSeverity}
                    onChange={(event) => setNewSeverity(event.target.value)}
                  >
                    <option value="info">Info</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                  </select>
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <Input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={requireAcknowledgement}
                    onChange={(event) => setRequireAcknowledgement(event.target.checked)}
                  />
                  <span>Require acknowledgement</span>
                </label>

                <div className="flex justify-end gap-2">
                  <DialogClose asChild>
                    <Button type="button" disabled={sending}>Close</Button>
                  </DialogClose>
                  <Button type="button" onClick={onSendNotification} disabled={sending}>
                    {sending ? "Sending..." : "Send"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button type="button" onClick={() => loadNotifications()} disabled={!selectedUser}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-2 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <h3 className="text-sm font-medium">User Notifications (Last 24h)</h3>
        <UserSearchCombobox
          accessToken={accessToken}
          onSelect={setSelectedUser}
          placeholder={selectedUser ? `${selectedUser.displayName} (${selectedUser.username})` : "Search and select user"}
        />
      </div>

      {!selectedUser ? <p className="text-sm text-slate-500 dark:text-slate-400">Select a user to view notifications.</p> : null}

      {selectedUser && loading ? <p className="text-sm">Loading notifications...</p> : null}
      {selectedUser && !loading && items.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No notifications in the past 24 hours.</p> : null}

      {selectedUser && items.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Message</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Read</th>
                <th className="px-3 py-2">Acknowledged</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const showResend = !item.readAt || (item.requiresAcknowledgement && !item.acknowledgedAt);
                return (
                  <tr key={item.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{item.severity}</td>
                    <td className="px-3 py-2">{item.message}</td>
                    <td className="px-3 py-2">{item.status}</td>
                    <td className="px-3 py-2">{item.readAt ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">{item.requiresAcknowledgement ? (item.acknowledgedAt ? "Yes" : "No") : "N/A"}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        {showResend ? (
                          <Button type="button" onClick={() => onResend(item.id)}>
                            Resend
                          </Button>
                        ) : null}
                        <Button type="button" onClick={() => onClear(item.id)}>
                          Clear
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
