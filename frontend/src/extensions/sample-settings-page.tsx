import { Button } from "../components/ui/button";

type SampleSettingsPageProps = {
  accessToken: string;
};

export function SampleSettingsPage({ accessToken }: SampleSettingsPageProps) {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-medium">Sample App Settings</h2>
      <div className="rounded-md border border-slate-200 p-4 text-sm dark:border-slate-800">
        <p className="text-slate-700 dark:text-slate-300">
          This is an example extension page registered through `frontend/src/extensions/settings-registry.tsx`.
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Access token available: {accessToken ? "yes" : "no"}
        </p>
        <div className="mt-3">
          <Button type="button">Example Action</Button>
        </div>
      </div>
    </section>
  );
}
