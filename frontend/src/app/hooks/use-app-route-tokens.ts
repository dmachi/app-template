import { useLocation } from "@tanstack/react-router";

export function useAppRouteTokens() {
  const location = useLocation();
  const locationPathname = location.pathname;
  const isVerifyEmailRoute = locationPathname === "/verify-email";
  const isAcceptInviteRoute = locationPathname === "/accept-invite";
  const searchParams = new URLSearchParams(location.searchStr || "");
  const tokenParam = searchParams.get("token");
  const inviteTokenParam = searchParams.get("inviteToken");
  const oauthReturnTo = searchParams.get("oauth_return_to");
  const emailVerificationToken = isVerifyEmailRoute ? tokenParam : null;
  const invitationToken = isAcceptInviteRoute ? tokenParam : null;

  return {
    locationPathname,
    isVerifyEmailRoute,
    isAcceptInviteRoute,
    tokenParam,
    inviteTokenParam,
    oauthReturnTo,
    emailVerificationToken,
    invitationToken,
  };
}