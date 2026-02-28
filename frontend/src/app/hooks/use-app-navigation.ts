import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";

import { createAuthPathWithInvite } from "./use-app-invitations";

export function useAppNavigation() {
  const routerNavigate = useNavigate();

  const navigateTo = useCallback((to: string, replace = false) => {
    void (routerNavigate as any)({ to, replace });
  }, [routerNavigate]);

  const navigateHome = useCallback(() => {
    navigateTo("/");
  }, [navigateTo]);

  const navigateLogin = useCallback(() => {
    navigateTo("/login");
  }, [navigateTo]);

  const navigateRegister = useCallback(() => {
    navigateTo("/register");
  }, [navigateTo]);

  const navigateSettingsProfile = useCallback((replace = false) => {
    navigateTo("/settings/profile", replace);
  }, [navigateTo]);

  const navigateHomeReplace = useCallback(() => {
    navigateTo("/", true);
  }, [navigateTo]);

  const navigateToAuthWithInvite = useCallback((nextView: "login" | "register", pendingInvitationToken: string | null) => {
    navigateTo(createAuthPathWithInvite(nextView, pendingInvitationToken));
  }, [navigateTo]);

  return {
    navigateTo,
    navigateHome,
    navigateLogin,
    navigateRegister,
    navigateSettingsProfile,
    navigateHomeReplace,
    navigateToAuthWithInvite,
  };
}