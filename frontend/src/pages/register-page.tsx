import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAppRouteRenderContext } from "../app/app-route-render-context";

export default function RegisterPage() {
  const routeContext = useAppRouteRenderContext();
  const props = routeContext.publicAuthProps;

  if (!props.registrationEnabled) {
    return <p className="text-sm">Registration is disabled.</p>;
  }

  return (
    <div className="grid w-full max-w-xl gap-3">
      <h2 className="text-xl font-medium">Register</h2>

      {!props.authMetaLoaded ? <p className="text-sm">Loading auth options...</p> : null}

      <form onSubmit={props.handleRegister} className="grid gap-3 rounded-md border border-slate-200 p-4 dark:border-slate-800">
        <label className="grid gap-1">
          <span className="text-sm">Username</span>
          <Input value={props.registerUsername} onChange={(event) => props.setRegisterUsername(event.target.value)} required />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Email</span>
          <Input type="email" value={props.registerEmail} onChange={(event) => props.setRegisterEmail(event.target.value)} required />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Password</span>
          <Input type="password" value={props.registerPassword} onChange={(event) => props.setRegisterPassword(event.target.value)} required />
        </label>
        <label className="grid gap-1">
          <span className="text-sm">Display Name (optional)</span>
          <Input value={props.registerDisplayName} onChange={(event) => props.setRegisterDisplayName(event.target.value)} />
        </label>
        {props.registerProfilePropertyCatalog.filter((property) => property.required).map((property) => {
          const raw = props.registerProfileProperties[property.key];
          const value = typeof raw === "string" ? raw : "";

          if (property.valueType === "links") {
            const links = props.getRegisterLinkItems(property.key);
            const maxItems = property.maxItems ?? 10;
            return (
              <label key={property.key} className="grid gap-1">
                <span className="text-sm">{property.label}</span>
                <p className="text-xs text-slate-500 dark:text-slate-400">{property.description}</p>
                {links.map((link, index) => (
                  <div key={`${property.key}-register-link-${index}`} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                    <Input
                      value={link.label}
                      placeholder="Label"
                      onChange={(event) => {
                        const next = [...links];
                        next[index] = { ...next[index], label: event.target.value };
                        props.setRegisterProfileProperties((current) => ({ ...current, [property.key]: next }));
                      }}
                    />
                    <Input
                      type="url"
                      value={link.url}
                      placeholder="https://..."
                      onChange={(event) => {
                        const next = [...links];
                        next[index] = { ...next[index], url: event.target.value };
                        props.setRegisterProfileProperties((current) => ({ ...current, [property.key]: next }));
                      }}
                    />
                    <Button
                      type="button"
                      className="bg-transparent"
                      onClick={() => {
                        const next = links.filter((_, itemIndex) => itemIndex !== index);
                        props.setRegisterProfileProperties((current) => ({ ...current, [property.key]: next }));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                {links.length < maxItems ? (
                  <Button
                    type="button"
                    className="bg-transparent"
                    onClick={() => {
                      const next = [...links, { label: "", url: "" }];
                      props.setRegisterProfileProperties((current) => ({ ...current, [property.key]: next }));
                    }}
                  >
                    Add Link
                  </Button>
                ) : null}
              </label>
            );
          }

          if (property.valueType === "boolean") {
            const checked = raw === true;
            return (
              <label key={property.key} className="grid gap-1">
                <span className="text-sm">{property.label}</span>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      props.setRegisterProfileProperties((current) => ({
                        ...current,
                        [property.key]: event.target.checked,
                      }))
                    }
                  />
                  <span>{property.description}</span>
                </label>
              </label>
            );
          }

          return (
            <label key={property.key} className="grid gap-1">
              <span className="text-sm">{property.label}</span>
              <Input
                type={property.valueType === "url" ? "url" : "text"}
                value={value}
                placeholder={property.placeholder}
                onChange={(event) =>
                  props.setRegisterProfileProperties((current) => ({
                    ...current,
                    [property.key]: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {property.description}
                {property.allowedHosts?.length ? ` Allowed hosts: ${property.allowedHosts.join(", ")}` : ""}
              </p>
            </label>
          );
        })}
        <Button type="submit">Create Account</Button>
      </form>

      {props.error ? <p className="text-sm text-red-600 dark:text-red-400">{props.error}</p> : null}
    </div>
  );
}
