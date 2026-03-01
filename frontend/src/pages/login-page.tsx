import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAppRouteRenderContext } from "../app/app-route-render-context";

export default function LoginPage() {
  const routeContext = useAppRouteRenderContext();
  const props = routeContext.publicAuthProps;
  const localEnabled = props.authProviders.some((provider) => provider.id === "local");
  const externalProviders = props.authProviders.filter((provider) => provider.id !== "local");

  return (
    <div className="grid w-full max-w-xl gap-3">
      <h2 className="text-xl font-medium">Login</h2>

      {!props.authMetaLoaded ? <p className="text-sm">Loading auth options...</p> : null}

      {localEnabled ? (
        <form onSubmit={props.handleLogin} className="grid gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
          <label className="grid gap-1">
            <span className="text-sm">Username or Email</span>
            <Input value={props.usernameOrEmail} onChange={(event) => props.setUsernameOrEmail(event.target.value)} required />
          </label>
          <label className="grid gap-1">
            <span className="text-sm">Password</span>
            <Input type="password" value={props.password} onChange={(event) => props.setPassword(event.target.value)} required />
          </label>
          <Button type="submit">Login</Button>
        </form>
      ) : null}

      {externalProviders.length > 0 ? (
        <div className="grid gap-2 rounded-md border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-sm font-medium">Enabled external providers</p>
          {externalProviders.map((provider) => (
            <Button key={provider.id} type="button" onClick={() => props.onProviderStart(provider.id)}>
              Continue with {provider.displayName}
            </Button>
          ))}
        </div>
      ) : null}

      {!localEnabled && externalProviders.length === 0 ? (
        <p className="text-sm">No authentication providers are enabled.</p>
      ) : null}

      {props.error ? <p className="text-sm text-red-600 dark:text-red-400">{props.error}</p> : null}
    </div>
  );
}
