import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "./ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { adminInviteUsers, adminListGroups, listMyGroupCollections } from "../lib/api";

type GroupOption = {
  id: string;
  name: string;
};

type InviteUsersDialogProps = {
  accessToken: string;
  onInvited?: () => Promise<void> | void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  triggerLabel?: string;
};

function parseEmails(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\s,;]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function InviteUsersDialog({
  accessToken,
  onInvited,
  open,
  onOpenChange,
  hideTrigger = false,
  triggerLabel = "Invite Users",
}: InviteUsersDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [emailsRaw, setEmailsRaw] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isControlled = typeof open === "boolean";
  const dialogOpen = isControlled ? Boolean(open) : internalOpen;

  function setDialogOpen(nextOpen: boolean) {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  }

  const selectedGroupSet = useMemo(() => new Set(selectedGroupIds), [selectedGroupIds]);

  useEffect(() => {
    if (!dialogOpen) {
      return;
    }

    adminListGroups(accessToken)
      .then((payload) => {
        setGroupOptions((payload.items || []).map((group) => ({ id: group.id, name: group.name })));
      })
      .catch(async () => {
        const mine = await listMyGroupCollections(accessToken);
        const merged = [...(mine.owned || []), ...(mine.memberOf || [])];
        const deduped = Array.from(new Map(merged.map((group) => [group.id, { id: group.id, name: group.name }])).values());
        setGroupOptions(deduped);
      });
  }, [dialogOpen, accessToken]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);

    const emails = parseEmails(emailsRaw);
    if (emails.length === 0) {
      setMessage("Enter at least one email address.");
      return;
    }
    if (selectedGroupIds.length === 0) {
      setMessage("Select at least one group.");
      return;
    }

    setSaving(true);
    try {
      const result = await adminInviteUsers(accessToken, {
        emails,
        groupIds: selectedGroupIds,
      });
      await onInvited?.();
      setMessage(`Invited: ${result.invited}, existing users added: ${result.addedExisting}`);
      if ((result.failures || []).length === 0) {
        setEmailsRaw("");
        setSelectedGroupIds([]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send invitations");
    } finally {
      setSaving(false);
    }
  }

  function toggleGroup(groupId: string) {
    if (selectedGroupSet.has(groupId)) {
      setSelectedGroupIds((prev) => prev.filter((item) => item !== groupId));
      return;
    }
    setSelectedGroupIds((prev) => [...prev, groupId]);
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {!hideTrigger ? (
        <DialogTrigger asChild>
          <Button type="button">{triggerLabel}</Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader className="mb-2">
          <DialogTitle>Invite Users</DialogTitle>
          <DialogDescription>Enter one or more email addresses and choose groups for membership assignment.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span>Email addresses</span>
            <textarea
              className="min-h-[90px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={emailsRaw}
              onChange={(event) => setEmailsRaw(event.target.value)}
              placeholder="alice@example.org, bob@example.org"
            />
          </label>

          <div className="grid gap-2 text-sm">
            <span>Groups</span>
            {groupOptions.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No groups available.</p>
            ) : (
              <div className="grid max-h-48 gap-2 overflow-auto rounded-md border border-slate-200 p-2 dark:border-slate-800">
                {groupOptions.map((group) => (
                  <label key={group.id} className="flex items-center gap-2">
                    <Input
                      type="checkbox"
                      checked={selectedGroupSet.has(group.id)}
                      onChange={() => toggleGroup(group.id)}
                      className="h-4 w-4"
                    />
                    <span>{group.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {message ? <p className="text-sm">{message}</p> : null}

          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" disabled={saving}>Close</Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>{saving ? "Sending..." : "Send Invites"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
