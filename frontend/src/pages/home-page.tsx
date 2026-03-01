import { Button } from "../components/ui/button";
import { useAppRouteRenderContext } from "../app/app-route-render-context";

export default function HomePage() {
  const routeContext = useAppRouteRenderContext();
  const { onNavigateLogin, navigateTo } = routeContext.settingsProps;
  const { isAuthenticated } = routeContext;

  return (
    <section className="rounded-md border border-slate-200 p-5 dark:border-slate-800">
      <h2 className="mb-2 text-2xl font-semibold">Home</h2>
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
