import { Button } from "../components/ui/button";
import { useAppRouteRenderContext } from "../app/app-route-render-context";
import { useActiveNotifications } from "../app/hooks/use-active-notifications";

export default function HomePage() {
  const routeContext = useAppRouteRenderContext();
  const { onNavigateLogin } = routeContext.publicAuthProps;
  const { navigateTo, accessToken, notificationRefreshSignal } = routeContext.settingsProps;
  const { isAuthenticated } = routeContext;
  const { activeNotifications } = useActiveNotifications({
    accessToken: isAuthenticated ? accessToken : null,
    navigateTo,
    notificationRefreshSignal,
  });

  return (
    <section className="rounded-md border border-slate-200 p-5 dark:border-slate-800">
      <h2 className="mb-2 text-2xl font-semibold">Home</h2>
      {isAuthenticated && activeNotifications.length > 0 ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          You have {activeNotifications.length} active notification{activeNotifications.length === 1 ? "" : "s"}.
        </div>
      ) : null}
      <p className="text-sm text-slate-700 dark:text-slate-300">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus vel augue ut velit pharetra suscipit.
        Suspendisse potenti. Integer id lorem vitae justo facilisis luctus non id velit.
      </p>
      <div className="mt-4">
        {isAuthenticated ? (
          <Button type="button" onClick={() => navigateTo("/settings/profile")}>Go to Settings</Button>
        ) : (
          <Button type="button" onClick={onNavigateLogin}>Login</Button>
        )}
      </div>
    </section>
  );
}
