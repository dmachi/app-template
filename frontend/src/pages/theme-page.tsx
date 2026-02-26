import { FormEvent, useState } from "react";

import { Button } from "../components/ui/button";
import { patchMyProfile } from "../lib/api";

type ThemeOption = "light" | "dark" | "system";

type ThemePageProps = {
  accessToken: string;
  theme: ThemeOption;
  onThemeChange: (theme: ThemeOption) => void;
};

export function ThemePage({ accessToken, theme, onThemeChange }: ThemePageProps) {
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await patchMyProfile(accessToken, { preferences: { theme } });
      setMessage("Theme preference updated");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save theme preference");
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
        <Button type="submit">Save Theme</Button>
      </form>
      {message ? <p className="text-sm">{message}</p> : null}
    </section>
  );
}
