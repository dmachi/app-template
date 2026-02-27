import { useEffect, useState } from "react";

import { Button } from "../components/ui/button";
import { showClientToast } from "../lib/client-toast";
import { getInvitation, type AuthProviderMeta } from "../lib/api";

type AcceptInvitePageProps = {
  token: string | null;
  registrationEnabled: boolean;
  authProviders: AuthProviderMeta[];
  isAuthenticated: boolean;
  acceptanceMessage?: string | null;
  accepting?: boolean;
  onLogin: () => void;
  onRegister: () => void;
  onProviderStart: (providerId: string) => void;
  onGoHome: () => void;
};

export function AcceptInvitePage({
  token,
  registrationEnabled,
  authProviders,
  isAuthenticated,
  acceptanceMessage,
  accepting,
  onLogin,
  onRegister,
  onProviderStart,
  onGoHome,
}: AcceptInvitePageProps) {
  const [loading, setLoading] = useState(Boolean(token));
  const [message, setMessage] = useState("Loading invitation...");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setMessage("Invitation token is missing.");
      showClientToast({ title: "Invitation", message: "Invitation token is missing.", severity: "error" });
      return;
    }

    setLoading(true);
    getInvitation(token)
      .then((payload) => {
        const infoMessage = `Invitation is valid for ${payload.invitedEmail}. Sign in or register to accept it.`;
        setMessage(infoMessage);
        showClientToast({ title: "Invitation", message: "Invitation token validated.", severity: "success" });
      })
      .catch((error) => {
        const errorMessage = error instanceof Error ? error.message : "Invitation not found or expired.";
        setMessage(errorMessage);
        showClientToast({ title: "Invitation", message: errorMessage, severity: "error" });
      })
      .finally(() => setLoading(false));
  }, [token]);

  const externalProviders = authProviders.filter((provider) => provider.id !== "local");

  return (
    <section className="grid max-w-xl gap-3 rounded-md border border-slate-200 p-5 dark:border-slate-800">
      <h2 className="text-xl font-semibold">Accept Invitation</h2>
      <p className="text-sm text-slate-700 dark:text-slate-300">{message}</p>

      {acceptanceMessage ? <p className="text-sm">{acceptanceMessage}</p> : null}

      {isAuthenticated ? (
        <p className="text-sm">You are signed in. The invitation will be accepted automatically.</p>
      ) : (
        <div className="grid gap-2">
          <Button type="button" onClick={onLogin} disabled={loading || accepting}>Login</Button>
          {registrationEnabled ? <Button type="button" onClick={onRegister} disabled={loading || accepting}>Register</Button> : null}
          {externalProviders.map((provider) => (
            <Button key={provider.id} type="button" onClick={() => onProviderStart(provider.id)} disabled={loading || accepting}>
              Continue with {provider.displayName}
            </Button>
          ))}
        </div>
      )}

      <Button type="button" className="bg-transparent" onClick={onGoHome}>Home</Button>
    </section>
  );
}
