import { Link } from "@tanstack/react-router";
import { useMemo, type ComponentType, type ReactNode } from "react";

import { AuthMenu, type AuthMenuProps } from "./auth-menu";
import { JobsBadge, type JobsStatusCounts } from "./jobs-badge";
import {
  NavigationMenuContent,
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "./ui/navigation-menu";
import {
  isNavigationItemActive,
  resolveNavigationMenuConfig,
  type NavigationMenuConfig,
  type NavigationVisibilityContext,
  type RenderableNavigationItem,
} from "./navigation-config";
import type { LayoutBranding } from "../lib/layouts/types";
import { cn } from "../lib/utils";

export type AppHeaderMode = "compact" | "standard" | "large";

export type AppHeaderDisplayConfig = {
  mode?: AppHeaderMode;
  fixed?: boolean;
  tagline?: string;
};

export type AppHeaderVariant = {
  classNames?: string[];
  bottomContent?: ReactNode;
  display?: AppHeaderDisplayConfig;
};

type AppHeaderMenu = {
  config: NavigationMenuConfig;
  visibilityContext: NavigationVisibilityContext;
  onNavigate: (path: string) => void;
};

type AppHeaderProps = {
  branding: LayoutBranding;
  authMenu?: AuthMenuProps;
  menu?: AppHeaderMenu;
  jobsStatusCounts?: JobsStatusCounts;
  jobsBadgeShowOnlyActive?: boolean;
  jobsBadgeShowOnlyNonZeroSegments?: boolean;
  display?: AppHeaderDisplayConfig;
  variant?: AppHeaderVariant;
};

function resolveHeaderMode(display?: AppHeaderDisplayConfig): AppHeaderMode {
  return display?.mode ?? "standard";
}

export function getAppHeaderOffsetClassName(display?: AppHeaderDisplayConfig): string {
  if (!display?.fixed) {
    return "";
  }

  const mode = resolveHeaderMode(display);
  if (mode === "compact") {
    return "pt-app-header-compact";
  }
  if (mode === "large") {
    return "pt-app-header-large md:pt-app-header-large-md";
  }
  return "pt-app-header";
}

export function AppHeader(props: AppHeaderProps) {
  const menu = props.menu;
  const effectiveDisplay = props.variant?.display ?? props.display;
  const mode = resolveHeaderMode(effectiveDisplay);
  const isFixed = Boolean(effectiveDisplay?.fixed);
  const tagline = mode === "large" ? effectiveDisplay?.tagline : undefined;
  const resolvedMenu = useMemo(
    () => (menu ? resolveNavigationMenuConfig(menu.config, menu.visibilityContext) : null),
    [menu],
  );

  function renderIcon(icon: ComponentType<{ className?: string }> | undefined) {
    if (!icon) {
      return <span className="inline-block h-4 w-4 rounded-full bg-slate-300 dark:bg-slate-700" aria-hidden />;
    }

    const Icon = icon;
    return <Icon className="h-4 w-4" aria-hidden />;
  }

  function renderNestedChildren(items: RenderableNavigationItem[], onNavigate: (path: string) => void, depth = 0) {
    return (
      <ul className="space-y-1">
        {items.map((child) => (
          <li key={child.id}>
            {child.path ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                style={{ marginLeft: `${depth * 10}px` }}
                onClick={() => onNavigate(child.path!)}
              >
                {renderIcon(child.icon)}
                <span className="truncate">{child.label}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium" style={{ marginLeft: `${depth * 10}px` }}>
                {renderIcon(child.icon)}
                <span className="truncate">{child.label}</span>
              </div>
            )}

            {child.children.length > 0 ? renderNestedChildren(child.children, onNavigate, depth + 1) : null}
          </li>
        ))}
      </ul>
    );
  }

  function renderTopLevelItem(item: RenderableNavigationItem, onNavigate: (path: string) => void, pathname: string) {
    const isActive = isNavigationItemActive(item, pathname);
    const activeClass = isActive ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50" : "";

    if (item.children.length > 0) {
      return (
        <NavigationMenuItem key={item.id}>
          <NavigationMenuTrigger className={activeClass}>
            <span className="mr-2">{renderIcon(item.icon)}</span>
            <span>{item.label}</span>
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="w-[20rem] rounded-md border border-slate-200 bg-white p-2 shadow-md dark:border-slate-800 dark:bg-slate-950">
              {item.path ? (
                <button
                  type="button"
                  className="mb-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => onNavigate(item.path!)}
                >
                  {renderIcon(item.icon)}
                  <span className="truncate">{item.label}</span>
                </button>
              ) : null}

              {renderNestedChildren(item.children, onNavigate)}
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      );
    }

    if (!item.path) {
      return null;
    }

    return (
      <NavigationMenuItem key={item.id}>
        <NavigationMenuLink asChild>
          <button
            type="button"
            className={`${navigationMenuTriggerStyle()} ${activeClass}`}
            onClick={() => onNavigate(item.path!)}
          >
            <span className="mr-2">{renderIcon(item.icon)}</span>
            <span>{item.label}</span>
          </button>
        </NavigationMenuLink>
      </NavigationMenuItem>
    );
  }

  const flattenedMenuItems = resolvedMenu ? resolvedMenu.sections.flatMap((section) => section.items) : [];
  const currentPathname = menu?.visibilityContext.pathname ?? "/";

  return (
    <header
      className={cn(
        "w-full border-b border-slate-200 dark:border-slate-800",
        mode === "large"
          ? "bg-gradient-to-r from-slate-100 via-white to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900"
          : "bg-white dark:bg-slate-950",
        isFixed ? "fixed inset-x-0 top-0 z-header" : "",
        props.variant?.classNames,
      )}
    >
      <div
        className={cn(
          "flex w-full items-center justify-between",
          mode === "compact" && "px-4 py-2",
          mode === "standard" && "px-6 py-3",
          mode === "large" && "px-6 py-5 md:px-8 md:py-6",
        )}
      >
        <div className={cn("flex min-w-0 items-center", mode === "compact" ? "gap-4" : "gap-6")}>
          <Link
            to="/"
            className={cn(
              "flex shrink-0 items-center gap-2 font-semibold",
              mode === "compact" && "text-lg",
              mode === "standard" && "text-xl",
              mode === "large" && "text-2xl",
            )}
          >
            {props.branding.appIconNode}
            <span className={tagline ? "leading-tight" : ""}>{props.branding.appName}</span>
          </Link>

          {tagline ? (
            <p className="hidden text-sm text-slate-600 md:block dark:text-slate-300">{tagline}</p>
          ) : null}

          {menu && flattenedMenuItems.length > 0 ? (
            <NavigationMenu className={mode === "compact" ? "scale-95 origin-left" : ""}>
              <NavigationMenuList>
                {flattenedMenuItems.map((item) => renderTopLevelItem(item, menu.onNavigate, currentPathname))}
              </NavigationMenuList>
            </NavigationMenu>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <JobsBadge
            counts={props.jobsStatusCounts}
            showOnlyActive={props.jobsBadgeShowOnlyActive}
            showOnlyNonZeroSegments={props.jobsBadgeShowOnlyNonZeroSegments}
            isAuthenticated={props.authMenu?.isAuthenticated}
            onClick={() => menu?.onNavigate("/jobs")}
          />
          {props.authMenu ? <AuthMenu {...props.authMenu} /> : null}
        </div>
      </div>

      {props.variant?.bottomContent ? (
        <div className="px-6 pb-4 md:px-8">{props.variant.bottomContent}</div>
      ) : null}
    </header>
  );
}