import { createRoute } from "@tanstack/react-router";
import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from "react";

import { useAppRouteRenderContext } from "../../app/app-route-render-context";

type RoutePageLayoutProps = {
  routeContext: ReturnType<typeof useAppRouteRenderContext>;
  Component: ComponentType;
};

type CreateLayoutRouteLayout = string | "none";

const layoutModuleLoaders = import.meta.glob<{ default: ComponentType<any> }>("../../layouts/*/index.tsx");

const layoutComponents = Object.fromEntries(
  Object.entries(layoutModuleLoaders).flatMap(([modulePath, loader]) => {
    const match = /^\.\.\/\.\.\/layouts\/([^/]+)\/index\.tsx$/.exec(modulePath);
    if (!match) {
      return [];
    }
    return [[match[1], lazy(loader)]];
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

  const WrappedComponent = () => {
    const LayoutComponent = layoutComponents[options.layout];

    if (!LayoutComponent) {
      throw new Error(`Route layout '${options.layout}' not found under src/layouts/<name>/index.tsx`);
    }

    const routeContext = useAppRouteRenderContext();
    return (
      <Suspense fallback={null}>
        <LayoutComponent routeContext={routeContext} Component={options.component} />
      </Suspense>
    );
  };

  return createRoute({
    getParentRoute: options.getParentRoute,
    path: options.path,
    component: WrappedComponent,
  });
}
