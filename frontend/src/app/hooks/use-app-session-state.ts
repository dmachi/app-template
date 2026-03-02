import { useState } from "react";
import type { AdminCapabilities } from "./types";

export type AdminCapabilitiesState = AdminCapabilities;

export function useAppSessionState() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [restoringSession, setRestoringSession] = useState(true);
  const [currentUsername, setCurrentUsername] = useState<string>("User");
  const [canAccessAdmin, setCanAccessAdmin] = useState<boolean | null>(null);
  const [adminAccessChecked, setAdminAccessChecked] = useState(false);
  const [adminCapabilities, setAdminCapabilities] = useState<AdminCapabilitiesState>({
    users: false,
    groups: false,
    invitations: false,
    roles: false,
    content: false,
    contentTypes: false,
  });
  const [pendingInvitationToken, setPendingInvitationToken] = useState<string | null>(null);
  const [acceptingInvitation, setAcceptingInvitation] = useState(false);
  const [invitationAcceptanceMessage, setInvitationAcceptanceMessage] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  return {
    accessToken,
    setAccessToken,
    refreshToken,
    setRefreshToken,
    restoringSession,
    setRestoringSession,
    currentUsername,
    setCurrentUsername,
    canAccessAdmin,
    setCanAccessAdmin,
    adminAccessChecked,
    setAdminAccessChecked,
    adminCapabilities,
    setAdminCapabilities,
    pendingInvitationToken,
    setPendingInvitationToken,
    acceptingInvitation,
    setAcceptingInvitation,
    invitationAcceptanceMessage,
    setInvitationAcceptanceMessage,
    inviteDialogOpen,
    setInviteDialogOpen,
  };
}