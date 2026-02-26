import { FormEvent, useEffect, useState } from "react";

import { FormField } from "../components/form-field";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { getMyProfile, patchMyProfile } from "../lib/api";

type ProfilePageProps = {
  accessToken: string;
};

export function ProfilePage({ accessToken }: ProfilePageProps) {
  const [displayName, setDisplayName] = useState("");
  const [theme, setTheme] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyProfile(accessToken)
      .then((profile) => {
        setDisplayName(profile.displayName ?? "");
        setTheme((profile.preferences?.theme as string) ?? "");
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
      await patchMyProfile(accessToken, { displayName, preferences: { theme } });
      setMessage("Profile updated");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save profile");
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
        <FormField label="Theme preference">
          <Input value={theme} onChange={(event) => setTheme(event.target.value)} placeholder="light | dark | system" />
        </FormField>
        <Button type="submit">Save</Button>
      </form>
      {message ? <p className="text-sm">{message}</p> : null}
    </section>
  );
}
