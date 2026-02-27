import { FormEvent, useEffect, useState } from "react";

import { FormField } from "../components/form-field";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { getMyProfile, patchMyProfile, resendMyVerificationEmail } from "../lib/api";

type ProfilePageProps = {
  accessToken: string;
};

export function ProfilePage({ accessToken }: ProfilePageProps) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [directRoles, setDirectRoles] = useState<string[]>([]);
  const [inheritedRoles, setInheritedRoles] = useState<Array<{ name: string; groups: string[] }>>([]);
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
      const updated = await patchMyProfile(accessToken, { displayName, email });
      setEmail(updated.email ?? email);
      setEmailVerified(Boolean(updated.emailVerified));
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
