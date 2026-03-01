import { FormEvent, useState } from "react";

import { useAppRouteRenderContext } from "../../app/app-route-render-context";
import { FormField } from "../../components/form-field";
import { SettingsLayout } from "../../layouts/settings-layout/";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { showClientToast } from "../../lib/client-toast";

export function SecurityPage() {
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
          <FormField label="Current password">
            <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </FormField>
          <FormField label="New password">
            <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
          </FormField>
          <FormField label="Confirm new password">
            <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
          </FormField>
          <Button type="submit">Reset Password</Button>
        </form>
      </div>

      <div className="grid gap-2 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <h3 className="text-base font-medium">API Credentials</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">API credential management will be added in a future milestone.</p>
      </div>
    </section>
  );
}

export default function SecurityRoutePage() {
  const routeContext = useAppRouteRenderContext();
  if (!routeContext.isAuthenticated) {
    return null;
  }
  return <SettingsLayout {...routeContext.settingsProps} />;
}
