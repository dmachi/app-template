import type { ComponentType } from "react";

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
  visibleWhen?: (context: NavigationVisibilityContext) => boolean;
  children?: NavigationItemConfig[];
};

export type NavigationSectionConfig = {
  id: string;
  title: string;
  requiresAuth?: boolean;
  roles?: string[];
  visibleWhen?: (context: NavigationVisibilityContext) => boolean;
  items: NavigationItemConfig[];
};

export type NavigationMenuConfig = {
  sections: NavigationSectionConfig[];
};

export type RenderableNavigationItem = Omit<NavigationItemConfig, "children"> & {
  children: RenderableNavigationItem[];
};

export type RenderableNavigationSection = Omit<NavigationSectionConfig, "items"> & {
  items: RenderableNavigationItem[];
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wildcardToRegex(pattern: string): RegExp {
  const escaped = escapeRegex(pattern).replace(/\\\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

export function pathMatches(pathname: string, pattern: string): boolean {
  if (pattern === pathname) {
    return true;
  }
  if (!pattern.includes("*")) {
    return false;
  }
  return wildcardToRegex(pattern).test(pathname);
}

export function getItemPatterns(item: Pick<NavigationItemConfig, "path" | "pathPatterns">): string[] {
  if (item.pathPatterns && item.pathPatterns.length > 0) {
    return item.pathPatterns;
  }
  if (item.path) {
    return [item.path];
  }
  return [];
}

function canViewByRoles(roles: string[] | undefined, contextRoles: string[]): boolean {
  if (!roles || roles.length === 0) {
    return true;
  }
  if (contextRoles.includes("Superuser")) {
    return true;
  }
  return roles.some((role) => contextRoles.includes(role));
}

function isVisibleByContext(
  itemOrSection: Pick<NavigationItemConfig, "requiresAuth" | "roles" | "visibleWhen">,
  context: NavigationVisibilityContext,
): boolean {
  if (itemOrSection.requiresAuth && !context.isAuthenticated) {
    return false;
  }

  const contextRoles = context.roles || [];
  if (!canViewByRoles(itemOrSection.roles, contextRoles)) {
    return false;
  }

  if (itemOrSection.visibleWhen && !itemOrSection.visibleWhen(context)) {
    return false;
  }

  return true;
}

function buildRenderableItem(item: NavigationItemConfig, context: NavigationVisibilityContext): RenderableNavigationItem | null {
  if (!isVisibleByContext(item, context)) {
    return null;
  }

  const children = (item.children || [])
    .map((child) => buildRenderableItem(child, context))
    .filter((child): child is RenderableNavigationItem => Boolean(child));

  if (!item.path && children.length === 0) {
    return null;
  }

  return {
    ...item,
    children,
  };
}

export function resolveNavigationMenuConfig(config: NavigationMenuConfig, context: NavigationVisibilityContext): { sections: RenderableNavigationSection[] } {
  const sections = config.sections
    .filter((section) => isVisibleByContext(section, context))
    .map((section): RenderableNavigationSection => ({
      ...section,
      items: section.items
        .map((item) => buildRenderableItem(item, context))
        .filter((item): item is RenderableNavigationItem => Boolean(item)),
    }))
    .filter((section) => section.items.length > 0);

  return { sections };
}

export function isNavigationItemActive(item: RenderableNavigationItem, pathname: string): boolean {
  const ownMatch = getItemPatterns(item).some((pattern) => pathMatches(pathname, pattern));
  if (ownMatch) {
    return true;
  }

  return item.children.some((child) => isNavigationItemActive(child, pathname));
}
