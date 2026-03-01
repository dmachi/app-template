import { Link } from "@tanstack/react-router";
import { Suspense, lazy, type ComponentType } from "react";

import { APP_SHELL_LAYOUT } from "../lib/layouts/layout-config";
import type { LayoutBranding, LayoutShell } from "../lib/layouts/types";

export type AppRootPresenterBranding = LayoutBranding;
export type AppRootPresenterShell = LayoutShell;

type AppRootPresenterProps = {
  restoringSession: boolean;
  accessToken: string | null;
  branding: AppRootPresenterBranding;
  shell: AppRootPresenterShell;
};

type AppShellLayoutProps = {
  accessToken: string | null;
  branding: AppRootPresenterBranding;
  shell: AppRootPresenterShell;
};

const appShellModuleLoaders = import.meta.glob<Record<string, unknown>>("../layouts/*/index.tsx");
const appShellModulePath = `../layouts/${APP_SHELL_LAYOUT}/index.tsx`;
const appShellModuleLoader = appShellModuleLoaders[appShellModulePath];
const ConfiguredAppShellLayout = appShellModuleLoader
  ? lazy(async () => {
      const module = await appShellModuleLoader();
      const defaultExport = module.default;
      const namedExport = Object.values(module).find((value) => typeof value === "function");
      const component = (defaultExport ?? namedExport) as ComponentType<AppShellLayoutProps> | undefined;

      if (!component) {
        throw new Error(`Layout module '${APP_SHELL_LAYOUT}' did not export a React component`);
      }

      return { default: component };
    })
  : null;

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

  if (!ConfiguredAppShellLayout) {
    throw new Error(`App shell layout '${APP_SHELL_LAYOUT}' not found under src/layouts/<name>/index.tsx`);
  }

  return (
    <Suspense fallback={null}>
      <ConfiguredAppShellLayout accessToken={props.accessToken} branding={props.branding} shell={props.shell} />
    </Suspense>
  );
}