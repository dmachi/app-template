import { Button } from "../../../components/ui/button";
import { ConfirmationDialog } from "../../../components/confirmation-dialog";
import { RoleDialog } from "../../../components/role-dialog";
import { Badge } from "../../../components/ui/badge";
import { useAppRouteRenderContext } from "../../../app/app-route-render-context";
import { showClientToast } from "../../../lib/client-toast";
import { adminCreateRole, adminDeleteRole, adminListRoles, adminPatchRole, type AdminRoleItem } from "../../../lib/api";
import { useEffect, useState } from "react";

type AdminRolesPageProps = {
  accessToken: string;
};

const CORE_ROLES = new Set([
  "Superuser",
  "AdminUsers",
  "AdminGroups",
  "GroupManager",
  "InviteUsers",
]);

export function AdminRolesPage({ accessToken }: AdminRolesPageProps) {
  const [roles, setRoles] = useState<AdminRoleItem[]>([]);

  async function loadRoles() {
    const payload = await adminListRoles(accessToken);
    setRoles(payload.items);
  }

  useEffect(() => {
    loadRoles().catch((error) => {
      showClientToast({ title: "Roles", message: error instanceof Error ? error.message : "Unable to load roles", severity: "error" });
    });
  }, [accessToken]);

  async function handleCreateRole(values: { name: string; description: string }) {
    try {
      await adminCreateRole(accessToken, values.name, values.description || undefined);
      await loadRoles();
      showClientToast({ title: "Roles", message: "Role created", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Roles", message: error instanceof Error ? error.message : "Unable to create role", severity: "error" });
    }
  }

  async function handleEditRole(values: { name: string; description: string }) {
    try {
      await adminPatchRole(accessToken, values.name, values.description || undefined);
      await loadRoles();
      showClientToast({ title: "Roles", message: "Role updated", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Roles", message: error instanceof Error ? error.message : "Unable to update role", severity: "error" });
    }
  }

  async function handleDeleteRole(roleName: string) {
    try {
      await adminDeleteRole(accessToken, roleName);
      await loadRoles();
      showClientToast({ title: "Roles", message: "Role deleted", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Roles", message: error instanceof Error ? error.message : "Unable to delete role", severity: "error" });
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
            {CORE_ROLES.has(role.name) ? <Badge variant="secondary">Core role</Badge> : null}
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
            {!CORE_ROLES.has(role.name) ? (
              <ConfirmationDialog
                triggerLabel="Delete"
                title="Delete Role"
                description={`Delete role \"${role.name}\"?`}
                confirmLabel="Delete"
                confirmTone="danger"
                onConfirm={() => handleDeleteRole(role.name)}
              />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AdminRolesRoutePage() {
  const routeContext = useAppRouteRenderContext();
  if (!routeContext.isAuthenticated) {
    return null;
  }
  return <AdminRolesPage accessToken={routeContext.settingsProps.accessToken} />;
}
