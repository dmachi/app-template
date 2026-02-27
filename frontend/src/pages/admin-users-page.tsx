import { useEffect, useMemo, useState } from "react";

import { AdminUserActions } from "../components/shared/admin-user-actions";
import { RoleBadges } from "../components/shared/role-badges";
import { Input } from "../components/ui/input";
import { adminListOutstandingInvitations, adminListUsers, type AdminUserListItem } from "../lib/api";

type AdminUsersPageProps = {
  accessToken: string;
  onOpenUser: (userId: string) => void;
  onOpenInvitations: () => void;
};

export function AdminUsersPage({ accessToken, onOpenUser, onOpenInvitations }: AdminUsersPageProps) {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [outstandingInvitationCount, setOutstandingInvitationCount] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState<string | null>(null);

  async function loadUsers() {
    const payload = await adminListUsers(accessToken);
    setUsers(payload.items);
  }

  async function loadOutstandingInvitations() {
    const payload = await adminListOutstandingInvitations(accessToken);
    setOutstandingInvitationCount((payload.items || []).length);
  }

  async function refreshData() {
    await Promise.all([loadUsers(), loadOutstandingInvitations()]);
  }

  useEffect(() => {
    refreshData().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Unable to load admin users");
    });
  }, [accessToken]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter((user) => {
      if (statusFilter !== "all" && user.status !== statusFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystacks = [
        user.displayName,
        user.username,
        user.email,
        ...(user.roles || []),
      ].map((value) => value.toLowerCase());
      return haystacks.some((value) => value.includes(normalizedQuery));
    });
  }, [query, statusFilter, users]);

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Admin Users</h2>
        <AdminUserActions
          accessToken={accessToken}
          outstandingInvitationCount={outstandingInvitationCount}
          onInvited={refreshData}
          onOpenInvitations={onOpenInvitations}
        />
      </div>

      <div className="grid gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name, username, email, role"
          />
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className="grid gap-2">
          {filteredUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              onDoubleClick={() => onOpenUser(user.id)}
              className={`rounded border px-3 py-2 text-left text-sm transition ${user.status === "disabled" ? "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500" : "border-slate-200 dark:border-slate-700"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{user.displayName || user.username}</div>
                <div className="text-xs uppercase tracking-wide">{user.status}</div>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">@{user.username} · {user.email}</div>
              <RoleBadges roles={user.roles || []} />
            </button>
          ))}
          {filteredUsers.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No users match the current filter.</p> : null}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Double-click a user to open details.</p>
      </div>

      {message ? <p className="text-sm">{message}</p> : null}
    </section>
  );
}
