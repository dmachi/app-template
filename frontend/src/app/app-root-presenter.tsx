import { Link } from "@tanstack/react-router";

import { AppLayout } from "../layouts/app-layout/";
import type { LayoutBranding, LayoutShell } from "../lib/layouts/types";

export type AppRootPresenterBranding = LayoutBranding;
export type AppRootPresenterShell = LayoutShell;

type AppRootPresenterProps = {
  restoringSession: boolean;
  accessToken: string | null;
  branding: AppRootPresenterBranding;
  shell: AppRootPresenterShell;
};

export function AppRootPresenter(props: AppRootPresenterProps) {
  if (props.restoringSession) {
    return (
      <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        <header className="w-full border-b border-slate-200 dark:border-slate-800">
          <div className="flex w-full items-center justify-between px-6 py-3">
            <Link to="/" className="flex items-center gap-2 text-xl font-semibold">
              {props.branding.appIconNode}
              <span>{props.branding.appName}</span>
            </Link>
          </div>
        </header>
        <main className="mx-auto grid w-full max-w-xl gap-3 px-4 py-6">
          <p className="text-sm">Restoring session...</p>
        </main>
      </div>
    );
  }

  return <AppLayout accessToken={props.accessToken} branding={props.branding} shell={props.shell} />;
}