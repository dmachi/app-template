import { Button } from "../components/ui/button";
import { ConfirmationDialog } from "../components/shared/confirmation-dialog";
import { RoleDialog } from "../components/shared/role-dialog";
import { adminCreateRole, adminDeleteRole, adminListRoles, adminPatchRole, type AdminRoleItem } from "../lib/api";
import { useEffect, useState } from "react";

type AdminRolesPageProps = {
  accessToken: string;
};

export function AdminRolesPage({ accessToken }: AdminRolesPageProps) {
  const [roles, setRoles] = useState<AdminRoleItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function loadRoles() {
    const payload = await adminListRoles(accessToken);
    setRoles(payload.items);
  }

  useEffect(() => {
    loadRoles().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Unable to load roles");
    });
  }, [accessToken]);

  async function handleCreateRole(values: { name: string; description: string }) {
    setMessage(null);
    try {
      await adminCreateRole(accessToken, values.name, values.description || undefined);
      await loadRoles();
      setMessage("Role created");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create role");
    }
  }

  async function handleEditRole(values: { name: string; description: string }) {
    setMessage(null);
    try {
      await adminPatchRole(accessToken, values.name, values.description || undefined);
      await loadRoles();
      setMessage("Role updated");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update role");
    }
  }

  async function handleDeleteRole(roleName: string) {
    setMessage(null);
    try {
      await adminDeleteRole(accessToken, roleName);
      await loadRoles();
      setMessage("Role deleted");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete role");
    }
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-medium">Admin Roles</h2>

      <RoleDialog
        triggerLabel="Create Role"
        title="Create Role"
        descriptionText="Provide role name and optional description."
        submitLabel="Create Role"
        onSubmit={handleCreateRole}
      />

      <div className="grid gap-2 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        {roles.map((role) => (
          <div key={role.name} className="flex items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
            <div className="mr-auto">
              <p className="font-medium">{role.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{role.description || "No description"}</p>
            </div>
            <RoleDialog
              triggerLabel="Edit"
              title="Edit Role"
              descriptionText="Update role description."
              initialName={role.name}
              initialDescription={role.description || ""}
              nameReadOnly={true}
              submitLabel="Save Role"
              onSubmit={handleEditRole}
            />
            <ConfirmationDialog
              triggerLabel="Delete"
              title="Delete Role"
              description={`Delete role \"${role.name}\"?`}
              confirmLabel="Delete"
              confirmTone="danger"
              onConfirm={() => handleDeleteRole(role.name)}
              disabled={role.name === "superuser"}
            />
          </div>
        ))}
      </div>

      {message ? <p className="text-sm">{message}</p> : null}
    </section>
  );
}
