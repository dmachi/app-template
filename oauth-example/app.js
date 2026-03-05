const RUNTIME_KEY = "oauth_example_runtime";
const TOKEN_KEY = "oauth_example_tokens";
const FORM_KEY = "oauth_example_form";
const LAST_AUTH_KEY = "oauth_example_last_auth";

function randomString(length = 64) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}

async function sha256Base64Url(input) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function readForm() {
  return {
    issuer: document.getElementById("issuer").value.trim().replace(/\/$/, ""),
    clientId: document.getElementById("clientId").value.trim(),
    redirectUri: document.getElementById("redirectUri").value.trim(),
    scope: document.getElementById("scope").value.trim(),
  };
}

function readTokens() {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

function readRuntime() {
  const raw = localStorage.getItem(RUNTIME_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(RUNTIME_KEY);
    return null;
  }
}

function writeOutput(targetId, data) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.textContent = JSON.stringify(data, null, 2);
}

function showAuthView(isAuthenticated) {
  const authSection = document.getElementById("authSection");
  const summarySection = document.getElementById("summarySection");
  if (authSection) authSection.hidden = isAuthenticated;
  if (summarySection) summarySection.hidden = !isAuthenticated;
}

function normalizeScopeInput(value) {
  return value
    .replace(/,/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(" ");
}

function writeForm(config) {
  if (!config) return;
  const normalizedScope = normalizeScopeInput(config.scope || "");
  if (normalizedScope === "openid profile email offline_access") {
    config.scope = "openid profile email";
  } else if (normalizedScope) {
    config.scope = normalizedScope;
  }
  if (config.issuer) document.getElementById("issuer").value = config.issuer;
  if (config.clientId) document.getElementById("clientId").value = config.clientId;
  if (config.redirectUri) document.getElementById("redirectUri").value = config.redirectUri;
  if (config.scope) document.getElementById("scope").value = config.scope;
}

async function loadDiscovery(issuer) {
  const response = await fetch(`${issuer}/api/v1/.well-known/openid-configuration`);
  if (!response.ok) {
    throw new Error(`Discovery failed: ${response.status}`);
  }
  return response.json();
}

function setDiscoveryOutput(data) {
  document.getElementById("discoveryOutput").textContent = JSON.stringify(data, null, 2);
}

async function onLoadDiscovery() {
  const { issuer } = readForm();
  const discovery = await loadDiscovery(issuer);
  setDiscoveryOutput(discovery);
}

async function onStartAuth() {
  const config = readForm();
  const normalizedScope = normalizeScopeInput(config.scope || "openid profile email");
  if (!config.issuer || !config.clientId || !config.redirectUri) {
    throw new Error("Issuer, client ID, and redirect URI are required");
  }

  const discovery = await loadDiscovery(config.issuer);
  setDiscoveryOutput(discovery);

  const codeVerifier = randomString(96);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const state = randomString(40);
  const nonce = randomString(40);

  const runtime = {
    config: {
      ...config,
      scope: normalizedScope,
    },
    discovery,
    codeVerifier,
    state,
    nonce,
    createdAt: Date.now(),
  };
  localStorage.setItem(RUNTIME_KEY, JSON.stringify(runtime));
  localStorage.setItem(
    FORM_KEY,
    JSON.stringify({
      ...config,
      scope: normalizedScope,
    }),
  );

  const url = new URL(discovery.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", normalizedScope || "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  window.location.assign(url.toString());
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

async function callUserInfo() {
  const runtime = readRuntime();
  const tokens = readTokens();
  if (!runtime || !tokens?.access_token) {
    throw new Error("Missing OAuth runtime or token state.");
  }
  const response = await fetch(runtime.discovery.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const payload = await response.json().catch(() => ({}));
  writeOutput("operationOutput", { endpoint: "userinfo", status: response.status, payload });
}

async function refreshToken() {
  const runtime = readRuntime();
  const tokens = readTokens();
  if (!runtime || !tokens?.refresh_token) {
    throw new Error("No refresh token available.");
  }
  const refreshed = await postForm(runtime.discovery.token_endpoint, {
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: runtime.config.clientId,
  });
  const merged = { ...tokens, ...refreshed };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(merged));
  writeOutput("tokenSummary", merged);
  writeOutput("operationOutput", { endpoint: "token(refresh)", payload: refreshed });
}

async function introspectToken() {
  const runtime = readRuntime();
  const tokens = readTokens();
  if (!runtime || !tokens?.access_token) {
    throw new Error("No access token available.");
  }
  const payload = await postForm(runtime.discovery.introspection_endpoint, {
    token: tokens.access_token,
    client_id: runtime.config.clientId,
  });
  writeOutput("operationOutput", { endpoint: "introspect", payload });
}

async function revokeToken() {
  const runtime = readRuntime();
  const tokens = readTokens();
  if (!runtime || !tokens?.access_token) {
    throw new Error("No access token available.");
  }
  const payload = await postForm(runtime.discovery.revocation_endpoint, {
    token: tokens.access_token,
    client_id: runtime.config.clientId,
  });
  localStorage.removeItem(TOKEN_KEY);
  localStorage.setItem(LAST_AUTH_KEY, JSON.stringify({ status: "revoked", at: new Date().toISOString() }));
  writeOutput("operationOutput", { endpoint: "revoke", payload });
  showAuthView(false);
}

function clearSessionState() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(RUNTIME_KEY);
  localStorage.setItem(LAST_AUTH_KEY, JSON.stringify({ status: "logged_out", at: new Date().toISOString() }));
}

async function endSession() {
  const runtime = readRuntime();
  const tokens = readTokens();
  clearSessionState();
  if (!runtime) {
    window.location.href = "/index.html";
    return;
  }
  const url = new URL(runtime.discovery.end_session_endpoint);
  if (tokens?.id_token) {
    url.searchParams.set("id_token_hint", tokens.id_token);
  }
  url.searchParams.set("client_id", runtime.config.clientId);
  url.searchParams.set("post_logout_redirect_uri", `${window.location.origin}/index.html`);
  url.searchParams.set("state", "logged-out");
  window.location.assign(url.toString());
}

function bindAction(id, handler) {
  const element = document.getElementById(id);
  if (!element) return;
  element.addEventListener("click", async () => {
    try {
      await handler();
    } catch (error) {
      writeOutput("operationOutput", { error: String(error) });
    }
  });
}

function renderSummary() {
  const tokens = readTokens();
  writeOutput("tokenSummary", tokens || { message: "No token state" });
  const statusRaw = localStorage.getItem(LAST_AUTH_KEY);
  if (statusRaw) {
    try {
      writeOutput("authStatus", JSON.parse(statusRaw));
    } catch {
      writeOutput("authStatus", { status: "unknown" });
    }
  } else {
    writeOutput("authStatus", { status: "authenticated" });
  }
}

function initialize() {
  document.getElementById("redirectUri").value = `${window.location.origin}/callback.html`;
  const saved = localStorage.getItem(FORM_KEY);
  if (saved) {
    try {
      writeForm(JSON.parse(saved));
    } catch {
      localStorage.removeItem(FORM_KEY);
    }
  }

  const loadBtn = document.getElementById("loadDiscovery");
  const startBtn = document.getElementById("startAuth");

  loadBtn.addEventListener("click", async () => {
    try {
      await onLoadDiscovery();
    } catch (error) {
      setDiscoveryOutput({ error: String(error) });
    }
  });

  startBtn.addEventListener("click", async () => {
    try {
      await onStartAuth();
    } catch (error) {
      alert(String(error));
    }
  });

  bindAction("userinfoBtn", callUserInfo);
  bindAction("refreshBtn", refreshToken);
  bindAction("introspectBtn", introspectToken);
  bindAction("revokeBtn", revokeToken);
  bindAction("logoutBtn", endSession);

  const isAuthenticated = Boolean(readTokens()?.access_token);
  showAuthView(isAuthenticated);
  if (isAuthenticated) {
    renderSummary();
  }
}

initialize();