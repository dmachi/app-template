import { useEffect, useState } from "react";

import { Button } from "../components/ui/button";
import { verifyEmail } from "../lib/api";

type VerifyEmailPageProps = {
  token: string | null;
  isAuthenticated: boolean;
  onGoHome: () => void;
  onGoLogin: () => void;
};

export function VerifyEmailPage({ token, isAuthenticated, onGoHome, onGoLogin }: VerifyEmailPageProps) {
  const [loading, setLoading] = useState(Boolean(token));
  const [message, setMessage] = useState<string>(token ? "Verifying your email..." : "Verification token is missing.");
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setVerified(false);
      setMessage("Verification token is missing or invalid.");
      return;
    }

    setLoading(true);
    verifyEmail(token)
      .then(() => {
        setVerified(true);
        setMessage("Email verified successfully.");
      })
      .catch((error) => {
        setVerified(false);
        setMessage(error instanceof Error ? error.message : "Unable to verify email.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <section className="grid max-w-xl gap-3 rounded-md border border-slate-200 p-5 dark:border-slate-800">
      <h2 className="text-xl font-semibold">Email Verification</h2>
      <p className="text-sm text-slate-700 dark:text-slate-300">{message}</p>
      <div className="flex gap-2">
        {isAuthenticated ? (
          <Button type="button" onClick={onGoHome} disabled={loading}>Go Home</Button>
        ) : (
          <Button type="button" onClick={onGoLogin} disabled={loading || !verified}>Go to Login</Button>
        )}
        <Button type="button" className="bg-transparent" onClick={onGoHome} disabled={loading}>Home</Button>
      </div>
    </section>
  );
}
