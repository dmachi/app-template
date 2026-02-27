import { useEffect, useMemo, useState } from "react";

import { CreateGroupDialog } from "../components/shared/create-group-dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { adminListGroups, createGroup, listMyGroupCollections } from "../lib/api";

type GroupsPageProps = {
  accessToken: string;
  canViewAllGroups: boolean;
  onOpenGroup: (groupId: string) => void;
};

type GroupItem = {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
  ownerDisplayName?: string;
};

type FilterMode = "all" | "mine" | "member";

type UnifiedGroupItem = GroupItem & {
  isMine: boolean;
  isMember: boolean;
};

export function GroupsPage({ accessToken, canViewAllGroups, onOpenGroup }: GroupsPageProps) {
  const [ownedGroups, setOwnedGroups] = useState<GroupItem[]>([]);
  const [memberGroups, setMemberGroups] = useState<GroupItem[]>([]);
  const [allGroups, setAllGroups] = useState<GroupItem[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function loadGroups() {
    const [myGroupsPayload, allGroupsPayload] = await Promise.all([
      listMyGroupCollections(accessToken),
      canViewAllGroups ? adminListGroups(accessToken) : Promise.resolve({ items: [] as GroupItem[] }),
    ]);
    const payload = myGroupsPayload;
    setOwnedGroups(payload.owned);
    setMemberGroups(payload.memberOf);
    setAllGroups(allGroupsPayload.items);
  }

  useEffect(() => {
    loadGroups().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Unable to load groups");
    });
  }, [accessToken, canViewAllGroups]);

  const unifiedGroups = useMemo<UnifiedGroupItem[]>(() => {
    const merged = new Map<string, UnifiedGroupItem>();

    for (const group of allGroups) {
      merged.set(group.id, {
        ...group,
        isMine: false,
        isMember: false,
      });
    }

    for (const group of ownedGroups) {
      const current = merged.get(group.id);
      merged.set(group.id, {
        ...(current ?? group),
        ...group,
        isMine: true,
        isMember: current?.isMember ?? false,
      });
    }

    for (const group of memberGroups) {
      const current = merged.get(group.id);
      merged.set(group.id, {
        ...(current ?? group),
        ...group,
        isMine: current?.isMine ?? false,
        isMember: true,
      });
    }

    return Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [allGroups, ownedGroups, memberGroups]);

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return unifiedGroups.filter((group) => {
      if (filterMode === "mine" && !group.isMine) {
        return false;
      }
      if (filterMode === "member" && !group.isMember) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystacks = [
        group.name,
        group.description || "",
        group.ownerDisplayName || "",
      ].map((value) => value.toLowerCase());

      return haystacks.some((value) => value.includes(normalizedQuery));
    });
  }, [filterMode, query, unifiedGroups]);

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-medium">Groups</h2>
      <CreateGroupDialog
        triggerLabel="Create Group"
        onCreate={async ({ name, description }) => {
          await createGroup(accessToken, { name, description });
          await loadGroups();
          setMessage("Group created");
        }}
      />

      <div className="grid gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
        <div className="grid gap-2 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className={filterMode === "all" ? "bg-slate-100 dark:bg-slate-800" : ""}
              onClick={() => setFilterMode("all")}
            >
              All
            </Button>
            <Button
              type="button"
              className={filterMode === "mine" ? "bg-slate-100 dark:bg-slate-800" : ""}
              onClick={() => setFilterMode("mine")}
            >
              Mine
            </Button>
            <Button
              type="button"
              className={filterMode === "member" ? "bg-slate-100 dark:bg-slate-800" : ""}
              onClick={() => setFilterMode("member")}
            >
              Member
            </Button>
          </div>

          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search groups by name, description, owner"
          />
        </div>

        <ul className="grid list-none gap-2 p-0">
          {filteredGroups.map((group) => (
            <li key={group.id} className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1 dark:border-slate-700">
              <div className="mr-auto">
                <p className="text-sm font-medium">{group.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {group.description || "No description"} · owner: {group.ownerDisplayName || "unknown"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {group.isMine ? "mine" : null}
                  {group.isMine && group.isMember ? " · " : null}
                  {group.isMember ? "member" : null}
                  {!group.isMine && !group.isMember && canViewAllGroups ? "admin-visible" : null}
                </p>
              </div>
              <Button type="button" onClick={() => onOpenGroup(group.id)}>
                Open
              </Button>
            </li>
          ))}
        </ul>
        {filteredGroups.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No groups match the current filters.</p> : null}
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
    </section>
  );
}
