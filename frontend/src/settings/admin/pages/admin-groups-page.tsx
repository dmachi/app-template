import { useEffect, useState } from "react";

import { ConfirmationDialog } from "../../../components/confirmation-dialog";
import { RoleBadges } from "../../../components/role-badges";
import { RoleAssignmentField } from "../../../components/role-assignment-field";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { showClientToast } from "../../../lib/client-toast";
import { adminAssignGroupRoles, adminDeleteGroup, adminListAssignableGroupRoles, adminListGroups, adminPatchGroup, type AdminRoleItem } from "../../../lib/api";

type AdminGroupsPageProps = {
  accessToken: string;
};

type GroupItem = {
  id: string;
  name: string;
  description?: string;
  ownerDisplayName?: string;
  roles?: string[];
};

export function AdminGroupsPage({ accessToken }: AdminGroupsPageProps) {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [assignableRoles, setAssignableRoles] = useState<AdminRoleItem[]>([]);

  async function loadGroups() {
    const payload = await adminListGroups(accessToken);
    setGroups(payload.items);
  }

  async function loadAssignableRoles() {
    const payload = await adminListAssignableGroupRoles(accessToken);
    setAssignableRoles(payload.items);
  }

  useEffect(() => {
    Promise.all([loadGroups(), loadAssignableRoles()]).catch((error) => {
      showClientToast({ title: "Groups", message: error instanceof Error ? error.message : "Unable to load groups", severity: "error" });
    });
  }, [accessToken]);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;

  useEffect(() => {
    if (!selectedGroup) {
      return;
    }
    setName(selectedGroup.name || "");
    setDescription(selectedGroup.description || "");
    setSelectedRoles(selectedGroup.roles || []);
  }, [selectedGroupId, selectedGroup?.name, selectedGroup?.description]);

  async function handleSaveGroup() {
    if (!selectedGroup) {
      return;
    }
    try {
      await adminPatchGroup(accessToken, selectedGroup.id, { name, description });
      await loadGroups();
      showClientToast({ title: "Groups", message: "Group updated", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Groups", message: error instanceof Error ? error.message : "Unable to update group", severity: "error" });
    }
  }

  async function handleSaveGroupRoles() {
    if (!selectedGroup) {
      return;
    }
    try {
      await adminAssignGroupRoles(accessToken, selectedGroup.id, selectedRoles);
      await loadGroups();
      showClientToast({ title: "Groups", message: "Group roles updated", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Groups", message: error instanceof Error ? error.message : "Unable to update group roles", severity: "error" });
    }
  }

  async function handleDeleteGroup(groupId: string) {
    try {
      await adminDeleteGroup(accessToken, groupId);
      if (selectedGroupId === groupId) {
        setSelectedGroupId(null);
      }
      await loadGroups();
      showClientToast({ title: "Groups", message: "Group deleted", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Groups", message: error instanceof Error ? error.message : "Unable to delete group", severity: "error" });
    }
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-medium">Admin All Groups</h2>

      <div className="grid gap-2 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        {groups.map((group) => (
          <div key={group.id} className="flex items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
            <button type="button" className="mr-auto text-left" onClick={() => setSelectedGroupId(group.id)}>
              <div className="font-medium">{group.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">owner: {group.ownerDisplayName || "unknown"}</div>
              <RoleBadges roles={group.roles || []} />
            </button>
            <ConfirmationDialog
              triggerLabel="Delete"
              title="Delete Group"
              description={`Delete group \"${group.name}\"? This action cannot be undone.`}
              confirmLabel="Delete"
              confirmTone="danger"
              onConfirm={() => handleDeleteGroup(group.id)}
            />
          </div>
        ))}
      </div>

      {selectedGroup ? (
        <div className="grid max-w-xl gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
          <label className="grid gap-1 text-sm">
            <span>Name</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Description</span>
            <Input value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <Button type="button" onClick={handleSaveGroup}>Save Group</Button>

          <div className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
            <RoleAssignmentField
              selectedRoles={selectedRoles}
              availableRoles={assignableRoles.map((role) => role.name)}
              onChange={setSelectedRoles}
              label="Assigned Roles"
              removeConfirmationContext="this group"
            />
            <Button type="button" onClick={handleSaveGroupRoles}>Save Group Roles</Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
