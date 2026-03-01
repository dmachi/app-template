import type { ComponentType, ReactNode } from "react";

import type { AppRouteRenderContextValue } from "../../app/app-route-render-context";
import type { SidebarResizableLevel } from "../../components/sidebar";
import { Sidebar } from "../../components/sidebar";
import {
  type NavigationMenuConfig,
} from "../../components/navigation-menu";
import { NavigationSidebar } from "./components/navigation-sidebar";

type NavigationSidebarLayoutProps = {
  locationPathname: string;
  isAuthenticated: boolean;
  navigationConfig: NavigationMenuConfig;
  onNavigate: (path: string) => void;
  children: ReactNode;
  visibilityContext?: Record<string, unknown>;
  sidebarType?: "fixed" | "resizable";
  fixedWidthClassName?: string;
  resizableLevels?: SidebarResizableLevel[];
  overlayWidthClassName?: string;
  contentClassName?: string;
};

type NavigationSidebarLayoutRouteProps = {
  routeContext: AppRouteRenderContextValue;
  Component: ComponentType;
  layoutProps?: Record<string, unknown>;
};

type NavigationSidebarLayoutRouteConfig = {
  navigationConfig: NavigationMenuConfig;
  sidebarType?: "fixed" | "resizable";
  fixedWidthClassName?: string;
  resizableLevels?: SidebarResizableLevel[];
  overlayWidthClassName?: string;
  contentClassName?: string;
};

export function NavigationSidebarLayout(props: NavigationSidebarLayoutProps) {
  return (
    <main className="w-full">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-0">
        <Sidebar
          type={props.sidebarType ?? "resizable"}
          fixedWidthClassName={props.fixedWidthClassName}
          resizableLevels={props.resizableLevels}
          overlayWidthClassName={props.overlayWidthClassName}
        >
          {({ iconMode }) => (
            <NavigationSidebar
              locationPathname={props.locationPathname}
              iconMode={iconMode}
              isAuthenticated={props.isAuthenticated}
              navigationConfig={props.navigationConfig}
              visibilityContext={props.visibilityContext}
              onNavigate={props.onNavigate}
            />
          )}
        </Sidebar>

        <section className={props.contentClassName ?? "pt-4 px-6"}>{props.children}</section>
      </div>
    </main>
  );
}

export default function NavigationSidebarLayoutRoute(props: NavigationSidebarLayoutRouteProps) {
  if (!props.routeContext.isAuthenticated) {
    return null;
  }

  const routeConfig = props.layoutProps as NavigationSidebarLayoutRouteConfig | undefined;
  if (!routeConfig?.navigationConfig) {
    return <props.Component />;
  }

  const settingsProps = props.routeContext.settingsProps;
  const roles: string[] = [];

  if (settingsProps.adminCapabilities.users) {
    roles.push("AdminUsers");
  }
  if (settingsProps.adminCapabilities.invitations) {
    roles.push("InviteUsers");
  }
  if (settingsProps.adminCapabilities.groups) {
    roles.push("AdminGroups");
  }
  if (settingsProps.adminCapabilities.roles) {
    roles.push("AdminRoles");
  }

  if (
    settingsProps.adminCapabilities.users
    && settingsProps.adminCapabilities.invitations
    && settingsProps.adminCapabilities.groups
    && settingsProps.adminCapabilities.roles
  ) {
    roles.push("Superuser");
  }

  return (
    <NavigationSidebarLayout
      locationPathname={settingsProps.locationPathname}
      isAuthenticated={props.routeContext.isAuthenticated}
      navigationConfig={routeConfig.navigationConfig}
      visibilityContext={{
        roles,
        canAccessAdmin: settingsProps.canAccessAdmin,
        adminCapabilities: settingsProps.adminCapabilities,
        selectedExtensionId: settingsProps.selectedExtensionId,
      }}
      onNavigate={(path) => settingsProps.navigateTo(path)}
      sidebarType={routeConfig.sidebarType}
      fixedWidthClassName={routeConfig.fixedWidthClassName}
      resizableLevels={routeConfig.resizableLevels}
      overlayWidthClassName={routeConfig.overlayWidthClassName}
      contentClassName={routeConfig.contentClassName}
    >
      <props.Component />
    </NavigationSidebarLayout>
  );
}
