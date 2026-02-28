import { FormEvent, useEffect, useState } from "react";

import { ConfirmationDialog } from "../../components/shared/confirmation-dialog";
import { RoleAssignmentField } from "../../components/shared/role-assignment-field";
import { UserSearchCombobox } from "../../components/shared/user-search-combobox";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { showClientToast } from "../../lib/client-toast";
import { addGroupMember, adminAssignGroupRoles, adminListAssignableGroupRoles, deleteGroup, getGroup, listGroupMembers, patchGroup, removeGroupMember } from "../../lib/api";

type GroupDetailPageProps = {
  accessToken: string;
  groupId: string;
  canAssignRoles?: boolean;
  onBack: () => void;
};

export function GroupDetailPage({ accessToken, groupId, canAssignRoles = false, onBack }: GroupDetailPageProps) {
  const [group, setGroup] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [assignableRoles, setAssignableRoles] = useState<string[]>([]);

  async function loadData() {
    const [groupPayload, membersPayload] = await Promise.all([
      getGroup(accessToken, groupId),
      listGroupMembers(accessToken, groupId),
    ]);
    setGroup(groupPayload);
    setMembers(membersPayload.items);
    setName(groupPayload.name ?? "");
    setDescription(groupPayload.description ?? "");
    setSelectedRoles(groupPayload.roles ?? []);
  }

  useEffect(() => {
    loadData().catch((error) => {
      showClientToast({ title: "Groups", message: error instanceof Error ? error.message : "Unable to load group", severity: "error" });
    });
  }, [accessToken, groupId]);

  useEffect(() => {
    if (!canAssignRoles) {
      setAssignableRoles([]);
      return;
    }

    adminListAssignableGroupRoles(accessToken)
      .then((payload) => {
        setAssignableRoles(payload.items.map((role) => role.name));
      })
      .catch((error) => {
        showClientToast({ title: "Groups", message: error instanceof Error ? error.message : "Unable to load assignable roles", severity: "error" });
      });
  }, [accessToken, canAssignRoles]);

  async function handleSaveGroup(event: FormEvent) {
    event.preventDefault();
    try {
      await patchGroup(accessToken, groupId, { name, description });
      await loadData();
      showClientToast({ title: "Groups", message: "Group updated", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Groups", message: error instanceof Error ? error.message : "Unable to update group", severity: "error" });
    }
  }

  async function handleSaveGroupRoles() {
    try {
      await adminAssignGroupRoles(accessToken, groupId, selectedRoles);
      await loadData();
      showClientToast({ title: "Groups", message: "Group roles updated", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Groups", message: error instanceof Error ? error.message : "Unable to update group roles", severity: "error" });
    }
  }

  if (!group) {
    return (
      <section className="grid gap-3">
        <Button onClick={onBack} type="button">
          Back to Groups
        </Button>
        <p className="text-sm">Loading group details...</p>
      </section>
    );
  }

  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-2">
        <Button onClick={onBack} type="button">
          Back to Groups
        </Button>
        <h2 className="text-lg font-medium">{group.name}</h2>
      </div>

      <form onSubmit={handleSaveGroup} className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800">
        <label className="grid gap-1">
          <span className="text-sm">Name</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} disabled={!group.canManage} required />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Description</span>
          <Input value={description} onChange={(event) => setDescription(event.target.value)} disabled={!group.canManage} />
        </label>
        <Button type="submit" disabled={!group.canManage}>
          Save Group
        </Button>
        <ConfirmationDialog
          triggerLabel="Delete Group"
          title="Delete Group"
          description={`Delete group \"${group.name}\"? This action cannot be undone.`}
          confirmLabel="Delete"
          confirmTone="danger"
          disabled={!group.canManage}
          triggerClassName="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
          onConfirm={async () => {
            try {
              await deleteGroup(accessToken, groupId);
              showClientToast({ title: "Groups", message: "Group deleted", severity: "success" });
              onBack();
            } catch (error) {
              showClientToast({ title: "Groups", message: error instanceof Error ? error.message : "Unable to delete group", severity: "error" });
            }
          }}
        />
      </form>

      {canAssignRoles ? (
        <div className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800">
          <h3 className="text-base font-medium">Assigned Roles</h3>
          <RoleAssignmentField
            selectedRoles={selectedRoles}
            availableRoles={assignableRoles}
            onChange={setSelectedRoles}
            label="Group Roles"
            removeConfirmationContext="this group"
          />
          <Button type="button" onClick={handleSaveGroupRoles} disabled={!group.canManage}>
            Save Group Roles
          </Button>
        </div>
      ) : null}

      <div className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800">
        <h3 className="text-base font-medium">Memberships</h3>
        {group.canManage ? (
          <UserSearchCombobox
            accessToken={accessToken}
            placeholder="Search and add user to group"
            onSelect={async (user) => {
              try {
                await addGroupMember(accessToken, groupId, user.username);
                await loadData();
                showClientToast({ title: "Groups", message: "Member added", severity: "success" });
              } catch (error) {
                showClientToast({ title: "Groups", message: error instanceof Error ? error.message : "Unable to add member", severity: "error" });
              }
            }}
          />
        ) : null}

        <ul className="grid list-none gap-2 p-0">
          {members.map((member) => (
            <li key={member.userId} className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1 dark:border-slate-700">
              <div className="mr-auto">
                <p className="text-sm font-medium">{member.displayName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{member.email} · {member.membershipRole}</p>
              </div>
              <ConfirmationDialog
                triggerLabel="Remove"
                title="Remove Member"
                description={`Remove ${member.displayName} from this group?`}
                confirmLabel="Remove"
                confirmTone="danger"
                disabled={!group.canManage || member.membershipRole === "owner"}
                onConfirm={async () => {
                  try {
                    await removeGroupMember(accessToken, groupId, member.userId);
                    await loadData();
                    showClientToast({ title: "Groups", message: "Member removed", severity: "success" });
                  } catch (error) {
                    showClientToast({ title: "Groups", message: error instanceof Error ? error.message : "Unable to remove member", severity: "error" });
                  }
                }}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
