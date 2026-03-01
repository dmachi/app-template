import type { ComponentType, ReactNode } from "react";

import type { AppRouteRenderContextValue } from "../../app/app-route-render-context";

type SimpleLayoutProps = {
  children: ReactNode;
  contentClassName?: string;
};

type SimpleLayoutRouteProps = {
  routeContext: AppRouteRenderContextValue;
  Component: ComponentType;
  layoutProps?: Record<string, unknown>;
};

type SimpleLayoutRouteConfig = {
  contentClassName?: string;
};

export function SimpleLayout(props: SimpleLayoutProps) {
  return (
    <main className="w-full">
      <section className={props.contentClassName ?? "pt-4 px-6"}>{props.children}</section>
    </main>
  );
}

export default function SimpleLayoutRoute(props: SimpleLayoutRouteProps) {
  const routeConfig = props.layoutProps as SimpleLayoutRouteConfig | undefined;

  return (
    <SimpleLayout contentClassName={routeConfig?.contentClassName}>
      <props.Component />
    </SimpleLayout>
  );
}
