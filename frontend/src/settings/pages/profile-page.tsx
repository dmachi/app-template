import { KeyboardEvent, useEffect, useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";

import { FormField } from "../../components/form-field";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { showClientToast } from "../../lib/client-toast";
import { getMyProfile, patchMyProfile, ProfilePropertyCatalogItem, ProfilePropertyLinkItem, resendMyVerificationEmail } from "../../lib/api";

type ProfilePageProps = {
  accessToken: string;
};

export function ProfilePage({ accessToken }: ProfilePageProps) {
  const [displayName, setDisplayName] = useState("");
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [editingDisplayName, setEditingDisplayName] = useState(false);

  const [email, setEmail] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);

  const [emailVerified, setEmailVerified] = useState(false);
  const [directRoles, setDirectRoles] = useState<string[]>([]);
  const [inheritedRoles, setInheritedRoles] = useState<Array<{ name: string; groups: string[] }>>([]);
  const [preferences, setPreferences] = useState<Record<string, unknown>>({});
  const [profileProperties, setProfileProperties] = useState<Record<string, unknown>>({});
  const [editingProfileKey, setEditingProfileKey] = useState<string | null>(null);
  const [profilePropertyCatalog, setProfilePropertyCatalog] = useState<ProfilePropertyCatalogItem[]>([]);

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyProfile(accessToken)
      .then((profile) => {
        setDisplayName(profile.displayName ?? "");
        setDisplayNameDraft(profile.displayName ?? "");
        setEmail(profile.email ?? "");
        setEmailDraft(profile.email ?? "");
        setEmailVerified(Boolean(profile.emailVerified));
        setDirectRoles(profile.roleSources?.direct || []);
        setInheritedRoles(profile.roleSources?.inherited || []);
        setPreferences(profile.preferences && typeof profile.preferences === "object" ? profile.preferences : {});
        setProfileProperties(profile.profileProperties && typeof profile.profileProperties === "object" ? profile.profileProperties : {});
        setProfilePropertyCatalog(Array.isArray(profile.profilePropertyCatalog) ? profile.profilePropertyCatalog : []);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "Unable to load profile");
      })
      .finally(() => setLoading(false));
  }, [accessToken]);

  async function patchProfile(
    key: string,
    body: { displayName?: string; email?: string; preferences?: Record<string, unknown>; profileProperties?: Record<string, unknown> },
  ) {
    setSavingKey(key);
    setMessage(null);
    try {
      const updated = await patchMyProfile(accessToken, body);
      setDisplayName(updated.displayName ?? "");
      setDisplayNameDraft(updated.displayName ?? "");
      setEmail(updated.email ?? email);
      setEmailDraft(updated.email ?? email);
      setEmailVerified(Boolean(updated.emailVerified));
      setPreferences(updated.preferences && typeof updated.preferences === "object" ? updated.preferences : preferences);
      setProfileProperties(updated.profileProperties && typeof updated.profileProperties === "object" ? updated.profileProperties : profileProperties);
      setProfilePropertyCatalog(Array.isArray(updated.profilePropertyCatalog) ? updated.profilePropertyCatalog : profilePropertyCatalog);
      showClientToast({ title: "Profile", message: "Saved", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Profile", message: error instanceof Error ? error.message : "Unable to save profile field", severity: "error" });
    } finally {
      setSavingKey(null);
    }
  }

  async function commitDisplayName() {
    const normalized = displayNameDraft.trim();
    if (!normalized || normalized === displayName) {
      setDisplayNameDraft(displayName);
      setEditingDisplayName(false);
      return;
    }

    await patchProfile("displayName", { displayName: normalized });
    setEditingDisplayName(false);
  }

  async function commitEmail() {
    const normalized = emailDraft.trim();
    if (!normalized || normalized === email) {
      setEmailDraft(email);
      setEditingEmail(false);
      return;
    }

    await patchProfile("email", { email: normalized });
    setEditingEmail(false);
  }

  async function commitProfileProperties(nextProfileProperties: Record<string, unknown>, key: string) {
    setProfileProperties(nextProfileProperties);
    await patchProfile(key, { profileProperties: nextProfileProperties });
  }

  function onInputEnter(event: KeyboardEvent<HTMLInputElement>, commit: () => Promise<void>) {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    void commit();
  }

  async function handleResendVerification() {
    setMessage(null);
    try {
      const response = await resendMyVerificationEmail(accessToken);
      showClientToast({ title: "Email", message: response.message || "Verification email sent", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Email", message: error instanceof Error ? error.message : "Unable to resend verification email", severity: "error" });
    }
  }

  if (loading) {
    return <p className="text-sm">Loading profile...</p>;
  }

  function getLinkItems(key: string): ProfilePropertyLinkItem[] {
    const value = profileProperties[key];
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((item): item is ProfilePropertyLinkItem => Boolean(item) && typeof item === "object" && "label" in item && "url" in item)
      .map((item) => ({ label: String(item.label ?? ""), url: String(item.url ?? "") }));
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-medium">Profile</h2>

      <div className="flex flex-wrap gap-2">
        {directRoles.map((role) => (
          <Badge key={`direct-${role}`} variant="default">
            {role}
          </Badge>
        ))}
        {inheritedRoles.map((role) => (
          <Badge
            key={`inherited-${role.name}`}
            variant="outline"
            title={`Inherited from group${role.groups.length === 1 ? "" : "s"}: ${role.groups.join(", ")}`}
          >
            {role.name}
          </Badge>
        ))}
        {directRoles.length === 0 && inheritedRoles.length === 0 ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">No roles assigned.</span>
        ) : null}
      </div>

      <div className="grid max-w-3xl gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <h3 className="text-sm font-medium">Basic Information</h3>
        <FormField label="Display name">
          {!editingDisplayName ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">{displayName || "-"}</span>
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
              onKeyDown={(event) => onInputEnter(event, commitDisplayName)}
            />
          )}
        </FormField>

        <FormField label="Email address">
          {!editingEmail ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">{email || "-"}</span>
                {!emailVerified ? (
                  <span className="text-xs text-amber-700 dark:text-amber-400">
                    Unverified
                  </span>
                ) : (
                  <span className="text-xs text-green-700 dark:text-green-400">Verified</span>
                )}
                {!emailVerified ? (
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
                ) : null}
              </div>
              <Button type="button" className="bg-transparent" onClick={() => setEditingEmail(true)} aria-label="Edit email" title="Edit email">
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="email"
                value={emailDraft}
                autoFocus
                onChange={(event) => setEmailDraft(event.target.value)}
                onBlur={() => {
                  void commitEmail();
                }}
                onKeyDown={(event) => onInputEnter(event, commitEmail)}
                className="min-w-[260px] flex-1"
              />
              {!emailVerified ? (
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  Unverified · {" "}
                  <button
                    type="button"
                    className="underline"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      void handleResendVerification();
                    }}
                  >
                    Resend verification email
                  </button>
                </span>
              ) : (
                <span className="text-xs text-green-700 dark:text-green-400">Verified</span>
              )}
            </div>
          )}
        </FormField>

      </div>

      {profilePropertyCatalog.length > 0 ? (
        <div className="grid max-w-3xl gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
          {profilePropertyCatalog.map((property) => {
          const raw = profileProperties[property.key];
          const value = typeof raw === "string" ? raw : "";

          if (property.valueType === "links") {
            const links = getLinkItems(property.key);
            const maxItems = property.maxItems ?? 10;
            return (
              <FormField key={property.key} label={property.label}>
                <div className="grid gap-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{property.description}</p>
                  {links.map((link, index) => (
                    <div key={`${property.key}-link-${index}`} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                      <Input
                        value={link.label}
                        placeholder="Label"
                        onChange={(event) => {
                          const next = [...links];
                          next[index] = { ...next[index], label: event.target.value };
                          setProfileProperties((current) => ({ ...current, [property.key]: next }));
                        }}
                        onBlur={() => {
                          void commitProfileProperties({ ...profileProperties, [property.key]: links }, `property:${property.key}`);
                        }}
                      />
                      <Input
                        type="url"
                        value={link.url}
                        placeholder="https://..."
                        onChange={(event) => {
                          const next = [...links];
                          next[index] = { ...next[index], url: event.target.value };
                          setProfileProperties((current) => ({ ...current, [property.key]: next }));
                        }}
                        onBlur={() => {
                          void commitProfileProperties({ ...profileProperties, [property.key]: links }, `property:${property.key}`);
                        }}
                      />
                      <Button
                        type="button"
                        className="bg-transparent"
                        onClick={() => {
                          const next = links.filter((_, itemIndex) => itemIndex !== index);
                          void commitProfileProperties({ ...profileProperties, [property.key]: next }, `property:${property.key}`);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  {links.length < maxItems ? (
                    <Button
                      type="button"
                      className="bg-transparent"
                      onClick={() => {
                        const next = [...links, { label: "", url: "" }];
                        setProfileProperties((current) => ({ ...current, [property.key]: next }));
                      }}
                    >
                      Add Link
                    </Button>
                  ) : null}
                </div>
              </FormField>
            );
          }

          if (property.valueType === "boolean") {
            const checked = raw === true;
            return (
              <FormField key={property.key} label={property.label}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const next = {
                        ...profileProperties,
                        [property.key]: event.target.checked,
                      };
                      void commitProfileProperties(next, `property:${property.key}`);
                    }}
                  />
                  <span>{property.description}</span>
                </label>
              </FormField>
            );
          }

          return (
            <FormField key={property.key} label={property.label}>
              {editingProfileKey !== property.key ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{value || "-"}</span>
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
                  type={property.valueType === "url" ? "url" : "text"}
                  value={value}
                  autoFocus
                  placeholder={property.placeholder}
                  onChange={(event) =>
                    setProfileProperties((current) => ({
                      ...current,
                      [property.key]: event.target.value,
                    }))
                  }
                  onBlur={() => {
                    void commitProfileProperties(
                      {
                        ...profileProperties,
                        [property.key]: value,
                      },
                      `property:${property.key}`,
                    );
                    setEditingProfileKey(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") {
                      return;
                    }
                    event.preventDefault();
                    const nextValue = (event.target as HTMLInputElement).value;
                    void commitProfileProperties(
                      {
                        ...profileProperties,
                        [property.key]: nextValue,
                      },
                      `property:${property.key}`,
                    );
                    setEditingProfileKey(null);
                  }}
                />
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {property.description}
                {property.allowedHosts?.length ? ` Allowed hosts: ${property.allowedHosts.join(", ")}` : ""}
              </p>
            </FormField>
          );
          })}
        </div>
      ) : null}
      {savingKey ? <p className="text-xs text-slate-500 dark:text-slate-400">Saving {savingKey}...</p> : null}
      {message ? <p className="text-sm text-red-600 dark:text-red-400">{message}</p> : null}
    </section>
  );
}
