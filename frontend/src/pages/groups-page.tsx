import { useEffect, useState } from "react";

import { CreateGroupDialog } from "../components/shared/create-group-dialog";
import { Button } from "../components/ui/button";
import { createGroup, listMyGroupCollections } from "../lib/api";

type GroupsPageProps = {
  accessToken: string;
  onOpenGroup: (groupId: string) => void;
};

type GroupItem = {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
  ownerDisplayName?: string;
};

export function GroupsPage({ accessToken, onOpenGroup }: GroupsPageProps) {
  const [ownedGroups, setOwnedGroups] = useState<GroupItem[]>([]);
  const [memberGroups, setMemberGroups] = useState<GroupItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function loadGroups() {
    const payload = await listMyGroupCollections(accessToken);
    setOwnedGroups(payload.owned);
    setMemberGroups(payload.memberOf);
  }

  useEffect(() => {
    loadGroups().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Unable to load groups");
    });
  }, [accessToken]);

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-medium">My Groups</h2>
      <CreateGroupDialog
        triggerLabel="Create Group"
        onCreate={async ({ name, description }) => {
          await createGroup(accessToken, { name, description });
          await loadGroups();
          setMessage("Group created");
        }}
      />

      <div className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800">
        <h3 className="text-base font-medium">Groups I Own</h3>
        <ul className="grid list-none gap-2 p-0">
          {ownedGroups.map((group) => (
            <li key={group.id} className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1 dark:border-slate-700">
              <div className="mr-auto">
                <p className="text-sm font-medium">{group.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{group.description} · {group.memberCount} members</p>
              </div>
              <Button type="button" onClick={() => onOpenGroup(group.id)}>
                Open
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800">
        <h3 className="text-base font-medium">Groups I Am A Member Of</h3>
        <ul className="grid list-none gap-2 p-0">
          {memberGroups.map((group) => (
            <li key={group.id} className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1 dark:border-slate-700">
              <div className="mr-auto">
                <p className="text-sm font-medium">{group.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{group.description} · owner: {group.ownerDisplayName}</p>
              </div>
              <Button type="button" onClick={() => onOpenGroup(group.id)}>
                Open
              </Button>
            </li>
          ))}
        </ul>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
    </section>
  );
}
