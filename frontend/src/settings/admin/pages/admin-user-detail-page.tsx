import { useEffect, useMemo, useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";

import { ConfirmationDialog } from "../../../components/confirmation-dialog";
import { RoleAssignmentField } from "../../../components/role-assignment-field";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { useAppRouteRenderContext } from "../../../app/app-route-render-context";
import { showClientToast } from "../../../lib/client-toast";
import {
  adminGetUser,
  adminListUserGroups,
  adminListRoles,
  adminPatchUser,
  adminResendUserVerificationEmail,
  adminResetUserPassword,
  type AdminUserGroupMembership,
  type AdminUserDetail,
} from "../../../lib/api";

type AdminUserDetailPageProps = {
  accessToken: string;
  userId: string;
  onBack: () => void;
};

export function AdminUserDetailPage({ accessToken, userId, onBack }: AdminUserDetailPageProps) {
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [userGroups, setUserGroups] = useState<AdminUserGroupMembership[]>([]);

  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);

  const [rolesDraft, setRolesDraft] = useState<string[]>([]);
  const [editingRoles, setEditingRoles] = useState(false);
  const [editingProfileKey, setEditingProfileKey] = useState<string | null>(null);
  const [profilePropertyDrafts, setProfilePropertyDrafts] = useState<Record<string, string>>({});

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const theme = typeof user?.preferences?.theme === "string" && user.preferences.theme.trim() ? user.preferences.theme : "system";
  const profileProperties = user?.profileProperties || {};
  const profilePropertyCatalog = user?.profilePropertyCatalog || [];
  const additionalPreferenceEntries = useMemo(
    () => Object.entries(user?.preferences || {}).filter(([key]) => key !== "profileProperties" && key !== "theme"),
    [user?.preferences],
  );

  async function loadUser() {
    setLoading(true);
    try {
      const payload = await adminGetUser(accessToken, userId);
      setUser(payload);
      setDisplayNameDraft(payload.displayName || "");
      setEmailDraft(payload.email || "");
      setRolesDraft(payload.roles || []);
      const nextDrafts: Record<string, string> = {};
      for (const item of payload.profilePropertyCatalog || []) {
        const currentValue = payload.profileProperties?.[item.key];
        nextDrafts[item.key] = typeof currentValue === "string" ? currentValue : "";
      }
      setProfilePropertyDrafts(nextDrafts);
    } catch (error) {
      showClientToast({ title: "User", message: error instanceof Error ? error.message : "Unable to load user", severity: "error" });
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadUserGroups() {
    if (!userId) {
      setUserGroups([]);
      return;
    }
    try {
      const payload = await adminListUserGroups(accessToken, userId);
      setUserGroups(payload.items || []);
    } catch {
      setUserGroups([]);
    }
  }

  useEffect(() => {
    adminListRoles(accessToken)
      .then((payload) => setAvailableRoles(payload.items.map((role) => role.name)))
      .catch(() => setAvailableRoles([]));
  }, [accessToken]);

  useEffect(() => {
    loadUser().catch(() => {
      showClientToast({ title: "User", message: "Unable to load user", severity: "error" });
      setLoading(false);
    });
    loadUserGroups().catch(() => {
      setUserGroups([]);
    });
  }, [accessToken, userId]);

  async function patchUser(
    key: string,
    body: {
      displayName?: string;
      email?: string;
      status?: string;
      roles?: string[];
      preferences?: Record<string, unknown>;
      profileProperties?: Record<string, unknown>;
    },
  ) {
    if (!user) {
      return;
    }

    setSavingKey(key);
    try {
      await adminPatchUser(accessToken, user.id, body);
      await loadUser();
      await loadUserGroups();
      showClientToast({ title: "User", message: "Saved", severity: "success" });
    } catch (error) {
      showClientToast({ title: "User", message: error instanceof Error ? error.message : "Unable to update user", severity: "error" });
    } finally {
      setSavingKey(null);
    }
  }

  async function commitDisplayName() {
    if (!user) {
      return;
    }

    const normalized = displayNameDraft.trim();
    if (!normalized || normalized === (user.displayName || "")) {
      setDisplayNameDraft(user.displayName || "");
      setEditingDisplayName(false);
      return;
    }

    await patchUser("displayName", { displayName: normalized });
    setEditingDisplayName(false);
  }

  async function commitEmail() {
    if (!user) {
      return;
    }

    const normalized = emailDraft.trim();
    if (!normalized || normalized === user.email) {
      setEmailDraft(user.email || "");
      setEditingEmail(false);
      return;
    }

    await patchUser("email", { email: normalized });
    setEditingEmail(false);
  }

  async function commitTheme(nextTheme: string) {
    if (!user || nextTheme === theme) {
      return;
    }

    const currentPreferences = user.preferences && typeof user.preferences === "object" ? user.preferences : {};
    await patchUser("theme", {
      preferences: {
        ...currentPreferences,
        theme: nextTheme,
      },
    });
  }

  async function commitRoles(nextRoles: string[]) {
    await patchUser("roles", { roles: nextRoles });
    setEditingRoles(false);
  }

  async function commitProfileProperty(key: string, value: string) {
    const current = user?.profileProperties?.[key];
    const currentText = typeof current === "string" ? current : "";
    if (value.trim() === currentText.trim()) {
      setEditingProfileKey(null);
      return;
    }

    await patchUser(`profile:${key}`, { profileProperties: { [key]: value } });
    setEditingProfileKey(null);
  }

  async function handleDisable() {
    if (!user) {
      return;
    }

    await patchUser("status", { status: "disabled" });
  }

  async function handleResetPassword() {
    if (!user) {
      return;
    }

    try {
      const payload = await adminResetUserPassword(accessToken, user.id);
      showClientToast({ title: "User", message: payload.message || "Password reset email queued", severity: "success" });
    } catch (error) {
      showClientToast({ title: "User", message: error instanceof Error ? error.message : "Unable to reset password", severity: "error" });
    }
  }

  async function handleResendVerification() {
    if (!user) {
      return;
    }

    try {
      const payload = await adminResendUserVerificationEmail(accessToken, user.id);
      showClientToast({ title: "Email", message: payload.message || "Verification email sent", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Email", message: error instanceof Error ? error.message : "Unable to resend verification email", severity: "error" });
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
      </section>
    );
  }

  const hasAdditionalProperties = profilePropertyCatalog.length > 0 || additionalPreferenceEntries.length > 0;

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Admin User Detail</h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="bg-transparent" onClick={handleResetPassword}>Reset Password</Button>
          <ConfirmationDialog
            triggerLabel={user.status === "disabled" ? "Disabled" : "Disable User"}
            title="Disable User"
            description="Disable this user account? The user will no longer be able to sign in."
            confirmLabel="Disable"
            confirmTone="danger"
            onConfirm={handleDisable}
            disabled={user.status === "disabled"}
            triggerClassName="bg-transparent"
          />
          <Button type="button" className="bg-transparent" onClick={onBack}>Back to Users</Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center justify-end">
          <Badge variant={user.status === "disabled" ? "destructive" : user.status === "pending" ? "secondary" : "default"}>
            {user.status}
          </Badge>
        </div>

        <div className="grid gap-1 text-xs text-slate-500 dark:text-slate-400 md:grid-cols-2">
          <div>ID: {user.id}</div>
          <div>Username: {user.username}</div>
          <div>Created: {new Date(user.createdAt).toLocaleString()}</div>
          <div>Updated: {new Date(user.updatedAt).toLocaleString()}</div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Display Name</span>
            {!editingDisplayName ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">{user.displayName || "-"}</span>
                <Button type="button" className="bg-transparent" onClick={() => setEditingDisplayName(true)} aria-label="Edit display name" title="Edit display name">
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <Input
                value={displayNameDraft}
                autoFocus
                onChange={(event) => setDisplayNameDraft(event.target.value)}
                onBlur={() => {
                  void commitDisplayName();
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") {
                    return;
                  }
                  event.preventDefault();
                  void commitDisplayName();
                }}
              />
            )}
          </div>

          <div className="grid gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Email</span>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {!editingEmail ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">{user.email}</span>
                    {user.emailVerified ? (
                      <span className="text-xs text-green-700 dark:text-green-400">Verified</span>
                    ) : (
                      <>
                        <span className="text-xs text-amber-700 dark:text-amber-400">Unverified</span>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs underline text-amber-700 dark:text-amber-400"
                          onClick={() => {
                            void handleResendVerification();
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Resend</span>
                        </button>
                      </>
                    )}
                  </div>
                  <Button type="button" className="bg-transparent" onClick={() => setEditingEmail(true)} aria-label="Edit email" title="Edit email">
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </>
              ) : (
                <Input
                  value={emailDraft}
                  autoFocus
                  type="email"
                  onChange={(event) => setEmailDraft(event.target.value)}
                  onBlur={() => {
                    void commitEmail();
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") {
                      return;
                    }
                    event.preventDefault();
                    void commitEmail();
                  }}
                />
              )}
            </div>
          </div>

          <div className="grid gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Roles</span>
            {!editingRoles ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {(user.roles || []).map((role) => (
                    <Badge key={role} variant="outline">{role}</Badge>
                  ))}
                  {(user.roles || []).length === 0 ? <span className="text-xs text-slate-500 dark:text-slate-400">No roles assigned.</span> : null}
                </div>
                <Button type="button" className="bg-transparent" onClick={() => setEditingRoles(true)} aria-label="Edit roles" title="Edit roles">
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <div className="grid gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800">
                <RoleAssignmentField selectedRoles={rolesDraft} availableRoles={availableRoles} onChange={setRolesDraft} label="" removeConfirmationContext={user.displayName || user.username} />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    className="bg-transparent"
                    onClick={() => {
                      setRolesDraft(user.roles || []);
                      setEditingRoles(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      void commitRoles(rolesDraft);
                    }}
                  >
                    Save Roles
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Theme</span>
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={theme}
              onChange={(event) => {
                void commitTheme(event.target.value);
              }}
            >
              <option value="system">system</option>
              <option value="light">light</option>
              <option value="dark">dark</option>
            </select>
          </div>
        </div>
      </div>

      {hasAdditionalProperties ? (
        <div className="grid gap-3 rounded-md border border-slate-200 p-4 text-sm dark:border-slate-800">
          {profilePropertyCatalog.length > 0 ? (
            <div className="grid gap-2">
              {profilePropertyCatalog.map((property) => {
                const rawValue = profileProperties[property.key];
                const rendered = typeof rawValue === "string" ? rawValue : rawValue != null ? JSON.stringify(rawValue) : "";
                const isTextLike = property.valueType === "text" || property.valueType === "url";

                if (!isTextLike) {
                  return (
                    <div key={property.key} className="grid gap-1">
                      <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{property.label}</span>
                      <div className="rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-900">{rendered || "-"}</div>
                    </div>
                  );
                }

                return (
                  <div key={property.key} className="grid gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{property.label}</span>
                    {editingProfileKey !== property.key ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm">{rendered || "-"}</span>
                        <Button
                          type="button"
                          className="bg-transparent"
                          onClick={() => setEditingProfileKey(property.key)}
                          aria-label={`Edit ${property.label}`}
                          title={`Edit ${property.label}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    ) : (
                      <Input
                        value={profilePropertyDrafts[property.key] ?? ""}
                        autoFocus
                        placeholder={property.placeholder}
                        type={property.valueType === "url" ? "url" : "text"}
                        onChange={(event) => {
                          const next = event.target.value;
                          setProfilePropertyDrafts((current) => ({ ...current, [property.key]: next }));
                        }}
                        onBlur={() => {
                          void commitProfileProperty(property.key, profilePropertyDrafts[property.key] ?? "");
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") {
                            return;
                          }
                          event.preventDefault();
                          void commitProfileProperty(property.key, profilePropertyDrafts[property.key] ?? "");
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}

          {additionalPreferenceEntries.length > 0 ? (
            <div className="grid gap-2">
              {additionalPreferenceEntries.map(([key, value]) => (
                <div key={key} className="grid gap-1">
                  <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{key}</span>
                  <div className="rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-900">{typeof value === "string" ? value : JSON.stringify(value)}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 rounded-md border border-slate-200 p-4 text-sm dark:border-slate-800">
        <h3 className="text-sm font-medium">Groups</h3>
        {userGroups.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">User is not a member of any groups.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2">Group</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Members</th>
                  <th className="px-3 py-2">Role</th>
                </tr>
              </thead>
              <tbody>
                {userGroups.map((group) => (
                  <tr key={group.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-3 py-2">{group.name}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{group.description || "-"}</td>
                    <td className="px-3 py-2">{group.memberCount}</td>
                    <td className="px-3 py-2">
                      {group.isOwner ? <Badge variant="default">Owner</Badge> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {savingKey ? <p className="text-xs text-slate-500 dark:text-slate-400">Saving {savingKey}...</p> : null}
    </section>
  );
}

export default function AdminUserDetailRoutePage() {
  const routeContext = useAppRouteRenderContext();
  if (!routeContext.isAuthenticated) {
    return null;
  }
  if (!routeContext.settingsProps.selectedAdminUserId) {
    return null;
  }

  return (
    <AdminUserDetailPage
      accessToken={routeContext.settingsProps.accessToken}
      userId={routeContext.settingsProps.selectedAdminUserId}
      onBack={() => routeContext.settingsProps.navigateTo("/settings/admin/users")}
    />
  );
}
