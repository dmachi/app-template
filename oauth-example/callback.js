const RUNTIME_KEY = "oauth_example_runtime";
const TOKEN_KEY = "oauth_example_tokens";
const LAST_AUTH_KEY = "oauth_example_last_auth";

function pretty(targetId, data) {
  document.getElementById(targetId).textContent = JSON.stringify(data, null, 2);
}

function parseCallback() {
  const params = new URLSearchParams(window.location.search);
  return {
    code: params.get("code"),
    state: params.get("state"),
    error: params.get("error"),
    errorDescription: params.get("error_description"),
  };
}

async function postForm(url, form) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Request failed (${response.status})`);
  }
  return payload;
}

function getRuntime() {
  const raw = localStorage.getItem(RUNTIME_KEY);
  if (!raw) throw new Error("Missing runtime state. Start from index page.");
  return JSON.parse(raw);
}

function getTokens() {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) throw new Error("No token response in session.");
  return JSON.parse(raw);
}

async function exchangeCode() {
  const callback = parseCallback();
  const runtime = getRuntime();

  if (callback.error) {
    localStorage.setItem(LAST_AUTH_KEY, JSON.stringify({ status: "error", callback }));
    if (callback.error === "invalid_scope") {
      pretty("authResult", {
        ...callback,
        hint: "Update the demo scope field or OAuth client allowed scopes. Default expected scope is: openid profile email",
      });
      window.location.replace("/index.html?auth=error");
      return;
    }
    pretty("authResult", callback);
    window.location.replace("/index.html?auth=error");
    return;
  }
  if (!callback.code) {
    throw new Error("No authorization code present.");
  }
  if (callback.state !== runtime.state) {
    throw new Error("State mismatch.");
  }

  const tokenPayload = await postForm(runtime.discovery.token_endpoint, {
    grant_type: "authorization_code",
    code: callback.code,
    client_id: runtime.config.clientId,
    redirect_uri: runtime.config.redirectUri,
    code_verifier: runtime.codeVerifier,
  });

  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenPayload));
  localStorage.setItem(
    LAST_AUTH_KEY,
    JSON.stringify({
      status: "authenticated",
      at: new Date().toISOString(),
      state: callback.state,
      scopes: tokenPayload.scope || "",
    }),
  );
  pretty("authResult", { code: callback.code, state: callback.state, validated: true });
  pretty("tokenOutput", tokenPayload);
  window.location.replace("/index.html?auth=success");
}

async function callUserInfo() {
  const runtime = getRuntime();
  const tokens = getTokens();
  const response = await fetch(runtime.discovery.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const payload = await response.json().catch(() => ({}));
  pretty("operationOutput", { endpoint: "userinfo", status: response.status, payload });
}

async function refreshToken() {
  const runtime = getRuntime();
  const tokens = getTokens();
  if (!tokens.refresh_token) throw new Error("No refresh_token available.");

  const refreshed = await postForm(runtime.discovery.token_endpoint, {
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: runtime.config.clientId,
  });
  const merged = { ...tokens, ...refreshed };
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(merged));
  pretty("tokenOutput", merged);
  pretty("operationOutput", { endpoint: "token(refresh)", payload: refreshed });
}

async function introspectToken() {
  const runtime = getRuntime();
  const tokens = getTokens();
  const payload = await postForm(runtime.discovery.introspection_endpoint, {
    token: tokens.access_token,
    client_id: runtime.config.clientId,
  });
  pretty("operationOutput", { endpoint: "introspect", payload });
}

async function revokeToken() {
  const runtime = getRuntime();
  const tokens = getTokens();
  const payload = await postForm(runtime.discovery.revocation_endpoint, {
    token: tokens.access_token,
    client_id: runtime.config.clientId,
  });
  pretty("operationOutput", { endpoint: "revoke", payload });
}

async function endSession() {
  const runtime = getRuntime();
  const tokens = getTokens();
  const url = new URL(runtime.discovery.end_session_endpoint);
  if (tokens.id_token) {
    url.searchParams.set("id_token_hint", tokens.id_token);
  }
  url.searchParams.set("client_id", runtime.config.clientId);
  url.searchParams.set("post_logout_redirect_uri", `${window.location.origin}/index.html`);
  url.searchParams.set("state", "logged-out");
  window.location.assign(url.toString());
}

function bindAction(id, handler) {
  document.getElementById(id).addEventListener("click", async () => {
    try {
      await handler();
    } catch (error) {
      pretty("operationOutput", { error: String(error) });
    }
  });
}

async function initialize() {
  bindAction("userinfoBtn", callUserInfo);
  bindAction("refreshBtn", refreshToken);
  bindAction("introspectBtn", introspectToken);
  bindAction("revokeBtn", revokeToken);
  bindAction("logoutBtn", endSession);

  try {
    await exchangeCode();
  } catch (error) {
    pretty("authResult", { error: String(error) });
  }
}

initialize();