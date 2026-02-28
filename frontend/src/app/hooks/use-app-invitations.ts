import { Dispatch, SetStateAction, useEffect } from "react";

import { acceptInvitation } from "../../lib/api";

type UseAutoAcceptInvitationParams = {
  accessToken: string | null;
  pendingInvitationToken: string | null;
  acceptingInvitation: boolean;
  locationPathname: string;
  inviteTokenStorageKey: string;
  setAcceptingInvitation: Dispatch<SetStateAction<boolean>>;
  setInvitationAcceptanceMessage: Dispatch<SetStateAction<string | null>>;
  setPendingInvitationToken: Dispatch<SetStateAction<string | null>>;
  navigateHomeReplace: () => void;
};

type UsePendingInvitationTokenSyncParams = {
  isAcceptInviteRoute: boolean;
  tokenParam: string | null;
  inviteTokenParam: string | null;
  inviteTokenStorageKey: string;
  setPendingInvitationToken: Dispatch<SetStateAction<string | null>>;
};

export function createAuthPathWithInvite(nextView: "login" | "register", pendingInvitationToken: string | null): string {
  const params = new URLSearchParams();
  if (pendingInvitationToken) {
    params.set("inviteToken", pendingInvitationToken);
  }
  const path = nextView === "register" ? "/register" : "/login";
  return params.toString() ? `${path}?${params.toString()}` : path;
}

export function usePendingInvitationTokenSync(params: UsePendingInvitationTokenSyncParams) {
  useEffect(() => {
    const storedPendingInviteToken = window.localStorage.getItem(params.inviteTokenStorageKey);
    if (params.isAcceptInviteRoute && params.tokenParam) {
      params.setPendingInvitationToken(params.tokenParam);
      window.localStorage.setItem(params.inviteTokenStorageKey, params.tokenParam);
      return;
    }
    if (params.inviteTokenParam) {
      params.setPendingInvitationToken(params.inviteTokenParam);
      window.localStorage.setItem(params.inviteTokenStorageKey, params.inviteTokenParam);
      return;
    }
    if (storedPendingInviteToken) {
      params.setPendingInvitationToken(storedPendingInviteToken);
    }
  }, [
    params.inviteTokenParam,
    params.inviteTokenStorageKey,
    params.isAcceptInviteRoute,
    params.setPendingInvitationToken,
    params.tokenParam,
  ]);
}

export function useAutoAcceptInvitation(params: UseAutoAcceptInvitationParams) {
  useEffect(() => {
    if (!params.accessToken || !params.pendingInvitationToken || params.acceptingInvitation) {
      return;
    }

    params.setAcceptingInvitation(true);
    params.setInvitationAcceptanceMessage("Accepting invitation...");

    acceptInvitation(params.accessToken, params.pendingInvitationToken)
      .then(() => {
        params.setInvitationAcceptanceMessage("Invitation accepted. Group membership has been updated.");
        params.setPendingInvitationToken(null);
        window.localStorage.removeItem(params.inviteTokenStorageKey);
        if (params.locationPathname === "/accept-invite") {
          params.navigateHomeReplace();
        }
      })
      .catch((inviteError) => {
        params.setInvitationAcceptanceMessage(inviteError instanceof Error ? inviteError.message : "Unable to accept invitation");
      })
      .finally(() => params.setAcceptingInvitation(false));
  }, [
    params.accessToken,
    params.acceptingInvitation,
    params.inviteTokenStorageKey,
    params.navigateHomeReplace,
    params.pendingInvitationToken,
    params.setAcceptingInvitation,
    params.setInvitationAcceptanceMessage,
    params.setPendingInvitationToken,
    params.locationPathname,
  ]);
}
