import { FormEvent, useEffect, useState } from "react";

import { FormField } from "../components/form-field";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { getMyProfile, patchMyProfile, ProfilePropertyCatalogItem, ProfilePropertyLinkItem, resendMyVerificationEmail } from "../lib/api";

type ProfilePageProps = {
  accessToken: string;
};

export function ProfilePage({ accessToken }: ProfilePageProps) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [directRoles, setDirectRoles] = useState<string[]>([]);
  const [inheritedRoles, setInheritedRoles] = useState<Array<{ name: string; groups: string[] }>>([]);
  const [preferences, setPreferences] = useState<Record<string, unknown>>({});
  const [profileProperties, setProfileProperties] = useState<Record<string, unknown>>({});
  const [profilePropertyCatalog, setProfilePropertyCatalog] = useState<ProfilePropertyCatalogItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyProfile(accessToken)
      .then((profile) => {
        setDisplayName(profile.displayName ?? "");
        setEmail(profile.email ?? "");
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

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      const updated = await patchMyProfile(accessToken, { displayName, email, preferences, profileProperties });
      setEmail(updated.email ?? email);
      setEmailVerified(Boolean(updated.emailVerified));
      setPreferences(updated.preferences && typeof updated.preferences === "object" ? updated.preferences : preferences);
      setProfileProperties(updated.profileProperties && typeof updated.profileProperties === "object" ? updated.profileProperties : profileProperties);
      setProfilePropertyCatalog(Array.isArray(updated.profilePropertyCatalog) ? updated.profilePropertyCatalog : profilePropertyCatalog);
      if (updated.emailVerified) {
        setMessage("Profile updated");
      } else {
        setMessage("Profile updated. Please check your email for a verification link.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save profile");
    }
  }

  async function handleResendVerification() {
    setMessage(null);
    try {
      const response = await resendMyVerificationEmail(accessToken);
      setMessage(response.message || "Verification email sent");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to resend verification email");
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
      <form onSubmit={handleSave} className="grid max-w-lg gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <FormField label="Display name">
          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
        </FormField>
        <FormField label="Email address">
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </FormField>
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
                      />
                      <Button
                        type="button"
                        className="bg-transparent"
                        onClick={() => {
                          const next = links.filter((_, itemIndex) => itemIndex !== index);
                          setProfileProperties((current) => ({ ...current, [property.key]: next }));
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
                    onChange={(event) =>
                      setProfileProperties((current) => ({
                        ...current,
                        [property.key]: event.target.checked,
                      }))
                    }
                  />
                  <span>{property.description}</span>
                </label>
              </FormField>
            );
          }

          return (
            <FormField key={property.key} label={property.label}>
              <Input
                type={property.valueType === "url" ? "url" : "text"}
                value={value}
                placeholder={property.placeholder}
                onChange={(event) =>
                  setProfileProperties((current) => ({
                    ...current,
                    [property.key]: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {property.description}
                {property.allowedHosts?.length ? ` Allowed hosts: ${property.allowedHosts.join(", ")}` : ""}
              </p>
            </FormField>
          );
        })}
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Email verification status: <strong>{emailVerified ? "Verified" : "Unverified"}</strong>
        </p>

        <div className="grid gap-1 text-sm">
          <span>Roles</span>
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
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit">Save</Button>
          {!emailVerified ? <Button type="button" className="bg-transparent" onClick={handleResendVerification}>Resend Verification Email</Button> : null}
        </div>
      </form>
      {message ? <p className="text-sm">{message}</p> : null}
    </section>
  );
}
