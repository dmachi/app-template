import { FormEvent, useState } from "react";

import { Button } from "../components/ui/button";
import { showClientToast } from "../lib/client-toast";
import { patchMyProfile } from "../lib/api";

type ThemeOption = "light" | "dark" | "system";

type ThemePageProps = {
  accessToken: string;
  theme: ThemeOption;
  onThemeChange: (theme: ThemeOption) => void;
};

export function ThemePage({ accessToken, theme, onThemeChange }: ThemePageProps) {
  const [saving, setSaving] = useState(false);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await patchMyProfile(accessToken, { preferences: { theme } });
      showClientToast({ title: "Theme", message: "Theme preference updated", severity: "success" });
    } catch (error) {
      showClientToast({ title: "Theme", message: error instanceof Error ? error.message : "Unable to save theme preference", severity: "error" });
    } finally {
      setSaving(false);
    }
  }

  function handleThemeChange(value: string) {
    const nextTheme = value as ThemeOption;
    onThemeChange(nextTheme);
  }

  return (
    <section className="grid gap-4">
      <h2 className="text-lg font-medium">Theme</h2>
      <form onSubmit={handleSave} className="grid max-w-lg gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <p className="text-sm">General theme selection</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="theme" value="light" checked={theme === "light"} onChange={(event) => handleThemeChange(event.target.value)} />
          Light
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="theme" value="dark" checked={theme === "dark"} onChange={(event) => handleThemeChange(event.target.value)} />
          Dark
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="theme" value="system" checked={theme === "system"} onChange={(event) => handleThemeChange(event.target.value)} />
          System
        </label>
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Theme"}</Button>
      </form>
    </section>
  );
}
