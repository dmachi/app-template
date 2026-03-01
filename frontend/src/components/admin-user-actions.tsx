import { InviteUsersDialog } from "./invite-users-dialog";
import { Button } from "./ui/button";

type AdminUserActionsProps = {
  accessToken: string;
  outstandingInvitationCount: number;
  onInvited?: () => Promise<void> | void;
  onOpenInvitations: () => void;
};

export function AdminUserActions({
  accessToken,
  outstandingInvitationCount,
  onInvited,
  onOpenInvitations,
}: AdminUserActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <InviteUsersDialog accessToken={accessToken} onInvited={onInvited} />
      <Button type="button" className="rounded-full px-3" onClick={onOpenInvitations}>
        Outstanding Invitations {outstandingInvitationCount}
      </Button>
    </div>
  );
}
