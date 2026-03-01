import type { ComponentType } from "react";

import {
  NavigationMenu,
  type NavigationMenuConfig,
  type NavigationVisibilityContext,
} from "../../../components/navigation-menu";

type NavigationSidebarProps = {
  locationPathname: string;
  iconMode: boolean;
  isAuthenticated: boolean;
  navigationConfig: NavigationMenuConfig;
  onNavigate: (path: string) => void;
  visibilityContext?: Record<string, unknown>;
};

export function NavigationSidebar(props: NavigationSidebarProps) {
  const context: NavigationVisibilityContext = {
    isAuthenticated: props.isAuthenticated,
    pathname: props.locationPathname,
    ...props.visibilityContext,
  };

  return (
    <NavigationMenu
      config={props.navigationConfig}
      pathname={props.locationPathname}
      isAuthenticated={props.isAuthenticated}
      iconMode={props.iconMode}
      visibilityContext={context}
      onNavigate={props.onNavigate}
    />
  );
}
