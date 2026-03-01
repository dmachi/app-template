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

  const activityBars = [72, 48, 85, 64, 93, 57, 76];
  const trendPoints = [25, 48, 37, 62, 55, 79, 66, 88];

  return (
    <section className="grid gap-6">
      {isAuthenticated ? (
        <div className="rounded-md border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Overview</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
            </div>
            <Button type="button" onClick={() => navigateTo("/settings/profile")}>Go to Settings</Button>
          </div>

          {activeNotifications.length > 0 ? (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              You have {activeNotifications.length} active notification{activeNotifications.length === 1 ? "" : "s"}.
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-500">Completion</p>
              <p className="mt-2 text-2xl font-semibold">84%</p>
              <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                <div className="h-2 w-[84%] rounded-full bg-slate-700 dark:bg-slate-300" />
              </div>
            </div>

            <div className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-500">Weekly Activity</p>
              <div className="mt-3 flex h-20 items-end gap-1">
                {activityBars.map((value, index) => (
                  <div key={`activity-${index}`} className="flex-1 rounded-sm bg-slate-300 dark:bg-slate-700" style={{ height: `${value}%` }} />
                ))}
              </div>
            </div>

            <div className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-500">Trend</p>
              <div className="mt-3 grid grid-cols-8 gap-1">
                {trendPoints.map((value, index) => (
                  <div key={`trend-${index}`} className="rounded-sm bg-slate-100 dark:bg-slate-800">
                    <div className="w-full rounded-sm bg-slate-500 dark:bg-slate-400" style={{ height: `${Math.max(value, 14)}px` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* {!isAuthenticated ? (
        <div className="rounded-md border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          <h2 className="text-lg font-semibold">Welcome</h2>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </p>
          <div className="mt-4">
            <Button type="button" onClick={onNavigateLogin}>Login</Button>
          </div>
        </div>
      ) : null} */}

      <div className="rounded-md border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <h3 className="text-base font-semibold">Section One</h3>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus vel augue ut velit pharetra suscipit. Suspendisse potenti.
          Integer id lorem vitae justo facilisis luctus non id velit. Donec in dui non leo posuere congue. Curabitur pretium, turpis nec
          pretium vulputate, sapien mi cursus justo, quis hendrerit tortor ligula in mauris.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="h-40 rounded-md bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900" />
          <div className="h-40 rounded-md border border-dashed border-slate-300 dark:border-slate-700" />
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <h3 className="text-base font-semibold">Section Two</h3>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
        </p>
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
          Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
          Morbi convallis, risus sit amet hendrerit facilisis, mauris sem volutpat velit, vitae iaculis sem justo vitae turpis.
          Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.
        </p>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <h3 className="text-base font-semibold">Section Three</h3>
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
            <div className="mb-2 h-20 rounded-md bg-slate-100 dark:bg-slate-800" />
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean pulvinar leo at sem sodales, vitae tincidunt risus tristique.
            </p>
          </div>
          <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
            <div className="mb-2 h-20 rounded-md bg-slate-100 dark:bg-slate-800" />
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent malesuada risus vel quam vestibulum, quis accumsan nibh feugiat.
            </p>
          </div>
          <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
            <div className="mb-2 h-20 rounded-md bg-slate-100 dark:bg-slate-800" />
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla facilisi. Cras tincidunt nibh sed nibh tincidunt, et aliquam nulla tincidunt.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
