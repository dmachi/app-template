import { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { Link } from "@tanstack/react-router";

import { AuthMenu } from "../shared/auth-menu";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { AcceptInvitePage } from "../../pages/accept-invite-page";
import { VerifyEmailPage } from "../../pages/verify-email-page";
import { AuthProviderMeta, ProfilePropertyCatalogItem, ProfilePropertyLinkItem } from "../../lib/api";

export type PublicAuthViewProps = {
  appName: string;
  appIconNode: ReactNode;
  registrationEnabled: boolean;
  locationPathname: string;
  authMetaLoaded: boolean;
  authProviders: AuthProviderMeta[];
  usernameOrEmail: string;
  password: string;
  setUsernameOrEmail: Dispatch<SetStateAction<string>>;
  setPassword: Dispatch<SetStateAction<string>>;
  handleLogin: (event: FormEvent) => Promise<void>;
  registerUsername: string;
  setRegisterUsername: Dispatch<SetStateAction<string>>;
  registerEmail: string;
  setRegisterEmail: Dispatch<SetStateAction<string>>;
  registerPassword: string;
  setRegisterPassword: Dispatch<SetStateAction<string>>;
  registerDisplayName: string;
  setRegisterDisplayName: Dispatch<SetStateAction<string>>;
  handleRegister: (event: FormEvent) => Promise<void>;
  registerProfilePropertyCatalog: ProfilePropertyCatalogItem[];
  registerProfileProperties: Record<string, unknown>;
  setRegisterProfileProperties: Dispatch<SetStateAction<Record<string, unknown>>>;
  getRegisterLinkItems: (key: string) => ProfilePropertyLinkItem[];
  emailVerificationToken: string | null;
  invitationToken: string | null;
  invitationAcceptanceMessage: string | null;
  acceptingInvitation: boolean;
  error: string | null;
  onNavigateHome: () => void;
  onNavigateLogin: () => void;
  onNavigateRegister: () => void;
  onNavigateToAuthWithInvite: (view: "login" | "register") => void;
  onProviderStart: (providerId: string) => Promise<void>;
};

export function PublicAuthView(props: PublicAuthViewProps) {
  const localEnabled = props.authProviders.some((provider) => provider.id === "local");
  const externalProviders = props.authProviders.filter((provider) => provider.id !== "local");
  const isHome = props.locationPathname === "/";
  const isLogin = props.locationPathname === "/login";
  const isRegister = props.locationPathname === "/register";
  const isVerifyEmail = props.locationPathname === "/verify-email";
  const isAcceptInvite = props.locationPathname === "/accept-invite";

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <header className="w-full border-b border-slate-200 dark:border-slate-800">
        <div className="flex w-full items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2 text-xl font-semibold">
            {props.appIconNode}
            <span>{props.appName}</span>
          </Link>
          <AuthMenu
            isAuthenticated={false}
            registrationEnabled={props.registrationEnabled}
            onLogin={props.onNavigateLogin}
            onRegister={props.onNavigateRegister}
            onSettings={() => {}}
            onLogout={() => {}}
          />
        </div>
      </header>

      <main className="w-full px-6 py-6">
        {isHome ? (
          <section className="rounded-md border border-slate-200 p-5 dark:border-slate-800">
            <h2 className="mb-2 text-2xl font-semibold">Home</h2>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus vel augue ut velit pharetra suscipit.
              Suspendisse potenti. Integer id lorem vitae justo facilisis luctus non id velit.
            </p>
            <div className="mt-4">
              <Button type="button" onClick={props.onNavigateLogin}>Login</Button>
            </div>
          </section>
        ) : null}

        {(isLogin || isRegister || isVerifyEmail || isAcceptInvite) ? (
          <div className="grid w-full max-w-xl gap-3">
            <h2 className="text-xl font-medium">{isLogin ? "Login" : isRegister ? "Register" : isVerifyEmail ? "Verify Email" : "Accept Invitation"}</h2>

            {!props.authMetaLoaded ? <p className="text-sm">Loading auth options...</p> : null}

            {isLogin && localEnabled ? (
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

            {isRegister && props.registrationEnabled ? (
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
            ) : null}

            {isLogin && externalProviders.length > 0 ? (
              <div className="grid gap-2 rounded-md border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-sm font-medium">Enabled external providers</p>
                {externalProviders.map((provider) => (
                  <Button key={provider.id} type="button" onClick={() => props.onProviderStart(provider.id)}>
                    Continue with {provider.displayName}
                  </Button>
                ))}
              </div>
            ) : null}

            {isLogin && !localEnabled && externalProviders.length === 0 ? (
              <p className="text-sm">No authentication providers are enabled.</p>
            ) : null}

            {isVerifyEmail ? (
              <VerifyEmailPage token={props.emailVerificationToken} isAuthenticated={false} onGoHome={props.onNavigateHome} onGoLogin={props.onNavigateLogin} />
            ) : null}

            {isAcceptInvite ? (
              <AcceptInvitePage
                token={props.invitationToken}
                registrationEnabled={props.registrationEnabled}
                authProviders={props.authProviders}
                isAuthenticated={false}
                acceptanceMessage={props.invitationAcceptanceMessage}
                accepting={props.acceptingInvitation}
                onLogin={() => props.onNavigateToAuthWithInvite("login")}
                onRegister={() => props.onNavigateToAuthWithInvite("register")}
                onProviderStart={props.onProviderStart}
                onGoHome={props.onNavigateHome}
              />
            ) : null}

            {props.error ? <p className="text-sm text-red-600 dark:text-red-400">{props.error}</p> : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}
