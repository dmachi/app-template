import { useMemo, type ComponentType } from "react";

import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "./ui/sidebar";
import {
  isNavigationItemActive,
  resolveNavigationMenuConfig,
  type NavigationMenuConfig,
  type NavigationVisibilityContext,
  type RenderableNavigationItem,
} from "./navigation-config";

export type {
  NavigationVisibilityContext,
  NavigationItemConfig,
  NavigationSectionConfig,
  NavigationMenuConfig,
} from "./navigation-config";

type NavigationMenuProps = {
  config: NavigationMenuConfig;
  pathname: string;
  isAuthenticated: boolean;
  iconMode?: boolean;
  onNavigate: (path: string) => void;
  visibilityContext?: Record<string, unknown>;
};

export function NavigationMenu(props: NavigationMenuProps) {
  const {
    config,
    pathname,
    isAuthenticated,
    iconMode = false,
    onNavigate,
    visibilityContext = {},
  } = props;

  const effectiveVisibilityContext = useMemo<NavigationVisibilityContext>(() => ({
    isAuthenticated,
    pathname,
    ...visibilityContext,
  }), [isAuthenticated, pathname, visibilityContext]);

  const resolvedConfig = useMemo(
    () => resolveNavigationMenuConfig(config, effectiveVisibilityContext),
    [config, effectiveVisibilityContext],
  );

  function hasActivePath(item: RenderableNavigationItem): boolean {
    return isNavigationItemActive(item, pathname);
  }

  function renderIcon(icon: ComponentType<{ className?: string }> | undefined, isIconMode: boolean) {
    const sizeClass = isIconMode ? "h-5 w-5" : "h-4 w-4";

    if (!icon) {
      return <span className={`inline-block ${sizeClass} rounded-full bg-slate-300 dark:bg-slate-700`} aria-hidden />;
    }

    const Icon = icon;
    return <Icon className={sizeClass} aria-hidden />;
  }

  function renderItemLabel(label: string, isIconMode: boolean) {
    if (!isIconMode) {
      return <span className="truncate">{label}</span>;
    }

    return (
      <span className="pointer-events-none absolute left-full z-50 ml-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs whitespace-nowrap opacity-0 shadow-sm transition-opacity group-hover:opacity-100 dark:border-slate-800 dark:bg-slate-900">
        {label}
      </span>
    );
  }

  function renderItems(items: RenderableNavigationItem[], iconMode: boolean, depth = 0) {
    return items.map((item) => {
      const isActive = hasActivePath(item);
      const canNavigate = Boolean(item.path);
      const hasChildren = item.children.length > 0;
      const leftIndent = !iconMode ? { marginLeft: `${depth * 10}px` } : undefined;

      if (hasChildren) {
        return (
          <SidebarMenuItem key={item.id}>
            {canNavigate && item.path ? (
              <SidebarMenuButton
                isActive={isActive}
                className={`${iconMode ? "group relative mx-auto h-10 w-10 justify-center p-0" : "justify-start"}`}
                style={leftIndent}
                aria-label={item.label}
                onClick={() => {
                  onNavigate(item.path!);
                }}
              >
                {renderIcon(item.icon, iconMode)}
                {renderItemLabel(item.label, iconMode)}
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                isActive={isActive}
                disabled
                className={`${iconMode ? "group relative mx-auto h-10 w-10 justify-center p-0" : "justify-start"}`}
                style={leftIndent}
                aria-label={item.label}
              >
                {renderIcon(item.icon, iconMode)}
                {renderItemLabel(item.label, iconMode)}
              </SidebarMenuButton>
            )}
            <SidebarMenuSub>{renderItems(item.children, iconMode, depth + 1)}</SidebarMenuSub>
          </SidebarMenuItem>
        );
      }

      return (
        <SidebarMenuItem key={item.id}>
          {depth === 0 ? (
            <SidebarMenuButton
              isActive={isActive}
              className={`${iconMode ? "group relative mx-auto h-10 w-10 justify-center p-0" : "justify-start"}`}
              style={leftIndent}
              aria-label={item.label}
              onClick={() => {
                if (!canNavigate || !item.path) {
                  return;
                }
                onNavigate(item.path);
              }}
            >
              {renderIcon(item.icon, iconMode)}
              {renderItemLabel(item.label, iconMode)}
            </SidebarMenuButton>
          ) : (
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                isActive={isActive}
                className={`${iconMode ? "group relative mx-auto h-10 w-10 justify-center p-0" : "justify-start"}`}
                style={leftIndent}
                aria-label={item.label}
                onClick={() => {
                  if (!canNavigate || !item.path) {
                    return;
                  }
                  onNavigate(item.path);
                }}
              >
                {renderIcon(item.icon, iconMode)}
                {renderItemLabel(item.label, iconMode)}
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          )}
        </SidebarMenuItem>
      );
    });
  }

  return (
    <SidebarContent>
      {resolvedConfig.sections.map((section) => (
        <SidebarGroup key={section.id}>
          {iconMode ? null : <SidebarGroupLabel>{section.title}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(section.items, iconMode)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </SidebarContent>
  );
}
