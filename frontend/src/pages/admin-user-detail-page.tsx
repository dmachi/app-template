import { FormEvent, useEffect, useState } from "react";

import { ConfirmationDialog } from "../components/shared/confirmation-dialog";
import { RoleAssignmentField } from "../components/shared/role-assignment-field";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { adminGetUser, adminListRoles, adminPatchUser, adminResetUserPassword, type AdminUserDetail } from "../lib/api";

type AdminUserDetailPageProps = {
  accessToken: string;
  userId: string;
  onBack: () => void;
};

export function AdminUserDetailPage({ accessToken, userId, onBack }: AdminUserDetailPageProps) {
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [organization, setOrganization] = useState("");
  const [status, setStatus] = useState("active");
  const [roles, setRoles] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadUser() {
    setLoading(true);
    try {
      const payload = await adminGetUser(accessToken, userId);
      setUser(payload);
      setDisplayName(payload.displayName || "");
      setStatus(payload.status || "active");
      setOrganization(payload.organization || "");
      setRoles(payload.roles || []);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    adminListRoles(accessToken)
      .then((payload) => {
        setAvailableRoles(payload.items.map((role) => role.name));
      })
      .catch(() => {
        setAvailableRoles([]);
      });
  }, [accessToken]);

  useEffect(() => {
    loadUser().catch(() => {
      setMessage("Unable to load user");
      setLoading(false);
    });
  }, [accessToken, userId]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!user) {
      return;
    }

    setMessage(null);

    try {
      await adminPatchUser(accessToken, user.id, {
        displayName,
        status,
        roles,
        preferences: {
          ...(user.preferences || {}),
          organization: organization.trim() || null,
        },
      });
      await loadUser();
      setMessage("User updated");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update user");
    }
  }

  async function handleDisable() {
    if (!user) {
      return;
    }

    setMessage(null);
    try {
      await adminPatchUser(accessToken, user.id, { status: "disabled" });
      await loadUser();
      setMessage("User disabled");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to disable user");
    }
  }

  async function handleResetPassword() {
    if (!user) {
      return;
    }

    setMessage(null);
    try {
      const payload = await adminResetUserPassword(accessToken, user.id);
      setMessage(payload.message || "Password reset email queued");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to reset password");
    }
  }

  if (loading) {
    return <p className="text-sm">Loading user details...</p>;
  }

  if (!user) {
    return (
      <section className="grid gap-3">
        <Button type="button" className="bg-transparent" onClick={onBack}>Back to Users</Button>
        <p className="text-sm">User not found.</p>
        {message ? <p className="text-sm text-red-600 dark:text-red-400">{message}</p> : null}
      </section>
    );
  }

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Admin User Detail</h2>
        <Button type="button" className="bg-transparent" onClick={onBack}>Back to Users</Button>
      </div>

      <form onSubmit={handleSave} className="grid gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <label className="grid gap-1 text-sm">
          <span>Display Name</span>
          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>

        <label className="grid gap-1 text-sm">
          <span>Status</span>
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="active">active</option>
            <option value="disabled">disabled</option>
            <option value="pending">pending</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span>Organization</span>
          <Input value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="Organization" />
        </label>

        <RoleAssignmentField selectedRoles={roles} availableRoles={availableRoles} onChange={setRoles} />

        <div className="grid gap-2 sm:grid-cols-3">
          <Button type="submit">Save User</Button>
          <Button type="button" className="bg-transparent" onClick={handleResetPassword}>Reset Password</Button>
          <ConfirmationDialog
            triggerLabel="Disable User"
            title="Disable User"
            description="Disable this user account? The user will no longer be able to sign in."
            confirmLabel="Disable"
            confirmTone="danger"
            onConfirm={handleDisable}
            disabled={user.status === "disabled"}
            triggerClassName="bg-transparent"
          />
        </div>
      </form>

      <div className="grid gap-2 rounded-md border border-slate-200 p-4 text-sm dark:border-slate-800">
        <h3 className="font-medium">User Data</h3>
        <div><strong>ID:</strong> {user.id}</div>
        <div><strong>Username:</strong> {user.username}</div>
        <div><strong>Email:</strong> {user.email}</div>
        <div><strong>Normalized Email:</strong> {user.emailNormalized}</div>
        <div><strong>Created:</strong> {new Date(user.createdAt).toLocaleString()}</div>
        <div><strong>Updated:</strong> {new Date(user.updatedAt).toLocaleString()}</div>
        <div>
          <strong>Preferences JSON:</strong>
          <pre className="mt-1 overflow-auto rounded bg-slate-100 p-2 text-xs dark:bg-slate-900">{JSON.stringify(user.preferences ?? {}, null, 2)}</pre>
        </div>
      </div>

      {message ? <p className="text-sm">{message}</p> : null}
    </section>
  );
}
