import { Suspense, lazy, type ComponentType } from "react";

import { AppHeader } from "../components/app-header";
import { APP_SHELL_LAYOUT } from "../config/layout-config";
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
        <AppHeader branding={props.branding} />
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