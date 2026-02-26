import { FormEvent, useEffect, useState } from "react";

import { UserSearchCombobox } from "../components/shared/user-search-combobox";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { addGroupMember, getGroup, listGroupMembers, patchGroup, removeGroupMember } from "../lib/api";

type GroupDetailPageProps = {
  accessToken: string;
  groupId: string;
  onBack: () => void;
};

export function GroupDetailPage({ accessToken, groupId, onBack }: GroupDetailPageProps) {
  const [group, setGroup] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function loadData() {
    const [groupPayload, membersPayload] = await Promise.all([
      getGroup(accessToken, groupId),
      listGroupMembers(accessToken, groupId),
    ]);
    setGroup(groupPayload);
    setMembers(membersPayload.items);
    setName(groupPayload.name ?? "");
    setDescription(groupPayload.description ?? "");
  }

  useEffect(() => {
    loadData().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Unable to load group");
    });
  }, [accessToken, groupId]);

  async function handleSaveGroup(event: FormEvent) {
    event.preventDefault();
    try {
      await patchGroup(accessToken, groupId, { name, description });
      await loadData();
      setMessage("Group updated");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update group");
    }
  }

  if (!group) {
    return (
      <section className="grid gap-3">
        <Button onClick={onBack} type="button">
          Back to Groups
        </Button>
        <p className="text-sm">Loading group details...</p>
        {message ? <p className="text-sm text-red-600 dark:text-red-400">{message}</p> : null}
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
      </form>

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
                setMessage("Member added");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Unable to add member");
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
              <Button
                type="button"
                disabled={!group.canManage || member.membershipRole === "owner"}
                onClick={async () => {
                  try {
                    await removeGroupMember(accessToken, groupId, member.userId);
                    await loadData();
                    setMessage("Member removed");
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Unable to remove member");
                  }
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
    </section>
  );
}
