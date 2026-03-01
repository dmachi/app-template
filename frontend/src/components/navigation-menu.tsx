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

export type NavigationVisibilityContext = {
  isAuthenticated: boolean;
  pathname: string;
  roles?: string[];
  [key: string]: unknown;
};

export type NavigationItemConfig = {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  path?: string;
  pathPatterns?: string[];
  requiresAuth?: boolean;
  roles?: string[];
  children?: NavigationItemConfig[];
};

export type NavigationSectionConfig = {
  id: string;
  title: string;
  requiresAuth?: boolean;
  roles?: string[];
  items: NavigationItemConfig[];
};

export type NavigationMenuConfig = {
  sections: NavigationSectionConfig[];
};

type NavigationMenuProps = {
  config: NavigationMenuConfig;
  pathname: string;
  isAuthenticated: boolean;
  iconMode?: boolean;
  onNavigate: (path: string) => void;
  visibilityContext?: Record<string, unknown>;
};

type RenderableNavigationItem = Omit<NavigationItemConfig, "children"> & {
  children: RenderableNavigationItem[];
};

type RenderableNavigationSection = Omit<NavigationSectionConfig, "items"> & {
  items: RenderableNavigationItem[];
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wildcardToRegex(pattern: string): RegExp {
  const escaped = escapeRegex(pattern).replace(/\\\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function pathMatches(pathname: string, pattern: string): boolean {
  if (pattern === pathname) {
    return true;
  }
  if (!pattern.includes("*")) {
    return false;
  }
  return wildcardToRegex(pattern).test(pathname);
}

function getItemPatterns(item: NavigationItemConfig): string[] {
  if (item.pathPatterns && item.pathPatterns.length > 0) {
    return item.pathPatterns;
  }
  if (item.path) {
    return [item.path];
  }
  return [];
}

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

  const resolvedConfig = useMemo(() => {
    function isVisible(itemOrSection: NavigationItemConfig | NavigationSectionConfig): boolean {
      if (itemOrSection.requiresAuth && !isAuthenticated) {
        return false;
      }

      if (!itemOrSection.roles || itemOrSection.roles.length === 0) {
        return true;
      }

      const currentRoles = effectiveVisibilityContext.roles || [];
      if (currentRoles.includes("Superuser")) {
        return true;
      }
      return itemOrSection.roles.some((role) => currentRoles.includes(role));
    }

    function buildItem(item: NavigationItemConfig): RenderableNavigationItem | null {
      if (!isVisible(item)) {
        return null;
      }

      const children = (item.children || [])
        .map(buildItem)
        .filter((child): child is RenderableNavigationItem => Boolean(child));

      if (!item.path && children.length === 0) {
        return null;
      }

      return {
        ...item,
        children,
      };
    }

    const sections = config.sections
      .filter((section) => isVisible(section))
      .map((section): RenderableNavigationSection => ({
        ...section,
        items: section.items
          .map(buildItem)
          .filter((item): item is RenderableNavigationItem => Boolean(item)),
      }))
      .filter((section) => section.items.length > 0);

    return { sections };
  }, [config.sections, effectiveVisibilityContext, isAuthenticated]);

  function hasActivePath(item: RenderableNavigationItem): boolean {
    const ownMatch = getItemPatterns(item).some((pattern) => pathMatches(pathname, pattern));
    if (ownMatch) {
      return true;
    }

    return item.children.some(hasActivePath);
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
