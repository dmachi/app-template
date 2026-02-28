import { useEffect, useState } from "react";

import { InviteUsersDialog } from "../../../components/shared/invite-users-dialog";
import { Button } from "../../../components/ui/button";
import { showClientToast } from "../../../lib/client-toast";
import {
  adminCopyInvitationLink,
  adminListOutstandingInvitations,
  adminResendInvitation,
  adminRevokeInvitation,
  type AdminOutstandingInvitation,
} from "../../../lib/api";

type AdminInvitationsPageProps = {
  accessToken: string;
};

export function AdminInvitationsPage({ accessToken }: AdminInvitationsPageProps) {
  const [invitations, setInvitations] = useState<AdminOutstandingInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadInvitations() {
    setLoading(true);
    try {
      const payload = await adminListOutstandingInvitations(accessToken);
      setInvitations(payload.items);
    } catch (error) {
      showClientToast({ title: "Invitations", message: error instanceof Error ? error.message : "Unable to load invitations", severity: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvitations().catch(() => {});
  }, [accessToken]);

  async function handleResend(invitationId: string) {
    try {
      await adminResendInvitation(accessToken, invitationId);
      await loadInvitations();
      showClientToast({ title: "Invitations", message: "Invitation resent.", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Invitations", message: error instanceof Error ? error.message : "Unable to resend invitation", severity: "error" });
    }
  }

  async function handleRevoke(invitationId: string) {
    try {
      await adminRevokeInvitation(accessToken, invitationId);
      await loadInvitations();
      showClientToast({ title: "Invitations", message: "Invitation revoked.", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Invitations", message: error instanceof Error ? error.message : "Unable to revoke invitation", severity: "error" });
    }
  }

  async function handleCopyLink(invitationId: string) {
    try {
      const payload = await adminCopyInvitationLink(accessToken, invitationId);
      await navigator.clipboard.writeText(payload.invitationLink);
      await loadInvitations();
      showClientToast({ title: "Invitations", message: "Invitation link copied to clipboard.", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Invitations", message: error instanceof Error ? error.message : "Unable to copy invitation link", severity: "error" });
    }
  }

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Outstanding Invitations</h2>
        <InviteUsersDialog
          accessToken={accessToken}
          onInvited={async () => {
            await loadInvitations();
          }}
        />
      </div>
      {loading ? <p className="text-sm">Loading invitations...</p> : null}
      {invitations.length === 0 && !loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No outstanding invitations.</p>
      ) : null}

      <div className="grid gap-2">
        {invitations.map((invitation) => (
          <div key={invitation.id} className="rounded border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
            <div className="font-medium">{invitation.invitedEmail}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Invited by {invitation.invitedByDisplayName || invitation.invitedByUserId}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Groups: {invitation.groupNames.length > 0 ? invitation.groupNames.join(", ") : invitation.groupIds.join(", ")}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Expires: {new Date(invitation.expiresAt).toLocaleString()}</div>
            <div className="mt-2 flex gap-2">
              <Button type="button" onClick={() => handleCopyLink(invitation.id)}>Copy Link</Button>
              <Button type="button" onClick={() => handleResend(invitation.id)}>Resend</Button>
              <Button type="button" onClick={() => handleRevoke(invitation.id)}>Revoke</Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
