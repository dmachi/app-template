import { FormEvent, useState } from "react";

import { useAppRouteRenderContext } from "../../app/app-route-render-context";
import { FormField } from "../../components/form-field";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { showClientToast } from "../../lib/client-toast";

type SecurityPageProps = {
  currentUserName?: string;
};

export function SecurityPage(props: SecurityPageProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function handlePasswordReset(event: FormEvent) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      showClientToast({ title: "Security", message: "New password and confirmation must match", severity: "warning" });
      return;
    }

    showClientToast({ title: "Security", message: "Password reset will be connected in a future milestone.", severity: "info" });
  }

  return (
    <section className="grid gap-4">
      <h2 className="text-lg font-medium">Security</h2>

      <div className="grid gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <h3 className="text-base font-medium">Password Reset</h3>
        <form onSubmit={handlePasswordReset} className="grid max-w-lg gap-3">
          <input
            type="text"
            autoComplete="username"
            value={props.currentUserName ?? ""}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
          />
          <FormField label="Current password">
            <Input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </FormField>
          <FormField label="New password">
            <Input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </FormField>
          <FormField label="Confirm new password">
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </FormField>
          <Button type="submit">Reset Password</Button>
        </form>
      </div>
    </section>
  );
}

export default function SecurityRoutePage() {
  const routeContext = useAppRouteRenderContext();
  if (!routeContext.isAuthenticated) {
    return null;
  }
  return <SecurityPage currentUserName={routeContext.shell?.currentUsername} />;
}
