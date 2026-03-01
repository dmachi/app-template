import { createRoute } from "@tanstack/react-router";
import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from "react";

import { useAppRouteRenderContext } from "../../app/app-route-render-context";
import { APP_SHELL_LAYOUT } from "../../config/layout-config";

type RoutePageLayoutProps = {
  routeContext: ReturnType<typeof useAppRouteRenderContext>;
  Component: ComponentType;
  layoutProps?: Record<string, unknown>;
};

type CreateLayoutRouteLayout = string | "none" | [string, Record<string, unknown>];

const layoutModuleLoaders = import.meta.glob<Record<string, unknown>>([
  "../../layouts/*/index.tsx",
  "!../../layouts/app-layout/index.tsx",
]);

function getLayoutNameFromModulePath(modulePath: string): string | null {
  const normalizedPath = modulePath.replace(/\\/g, "/");
  const match = normalizedPath.match(/(?:^|\/)layouts\/([^/]+)\/index\.tsx$/);
  return match?.[1] ?? null;
}

function resolveLayoutModuleComponent(
  layoutName: string,
  module: Record<string, unknown>,
): ComponentType<RoutePageLayoutProps> {
  const defaultExport = module.default;
  const namedExport = Object.values(module).find((value) => typeof value === "function");
  const component = (defaultExport ?? namedExport) as ComponentType<RoutePageLayoutProps> | undefined;

  if (!component) {
    throw new Error(`Route layout '${layoutName}' module did not export a React component`);
  }

  return component;
}

const layoutComponents = Object.fromEntries(
  Object.entries(layoutModuleLoaders).flatMap(([modulePath, loader]) => {
    const layoutName = getLayoutNameFromModulePath(modulePath);
    if (!layoutName) {
      return [];
    }

    return [[layoutName, lazy(async () => ({ default: resolveLayoutModuleComponent(layoutName, await loader()) }))]];
  }),
) as Record<string, ComponentType<RoutePageLayoutProps>>;

type CreateLayoutRouteOptions = {
  getParentRoute: () => any;
  path: string;
  layout?: CreateLayoutRouteLayout;
  component: ComponentType | LazyExoticComponent<ComponentType<any>>;
};

export function createLayoutRoute(options: CreateLayoutRouteOptions) {
  if (!options.layout || options.layout === "none") {
    const DirectComponent = () => <options.component />;

    return createRoute({
      getParentRoute: options.getParentRoute,
      path: options.path,
      component: DirectComponent,
    });
  }

  const layoutName = Array.isArray(options.layout) ? options.layout[0] : options.layout;
  const layoutProps = Array.isArray(options.layout) ? options.layout[1] : undefined;

  if (layoutName === APP_SHELL_LAYOUT) {
    throw new Error(`Route layout '${APP_SHELL_LAYOUT}' is reserved for the app shell presenter and cannot be used in createLayoutRoute`);
  }

  const WrappedComponent = () => {
    const LayoutComponent = layoutComponents[layoutName];

    if (!LayoutComponent) {
      const availableLayouts = Object.keys(layoutComponents).sort();
      throw new Error(`Route layout '${layoutName}' not found under src/layouts/<name>/index.tsx (available: ${availableLayouts.join(", ") || "none"})`);
    }

    const routeContext = useAppRouteRenderContext();
    return (
      <Suspense fallback={null}>
        <LayoutComponent routeContext={routeContext} Component={options.component} layoutProps={layoutProps} />
      </Suspense>
    );
  };

  return createRoute({
    getParentRoute: options.getParentRoute,
    path: options.path,
    component: WrappedComponent,
  });
}
