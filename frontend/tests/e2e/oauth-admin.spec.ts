import { expect, test, type Page } from "@playwright/test";

type CapabilitySet = {
  anyAdmin: boolean;
  users: boolean;
  groups: boolean;
  invitations: boolean;
  roles: boolean;
  content: boolean;
  contentTypes: boolean;
};

const SUPERUSER_CAPABILITIES: CapabilitySet = {
  anyAdmin: true,
  users: true,
  groups: true,
  invitations: true,
  roles: true,
  content: true,
  contentTypes: true,
};

async function seedSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("refreshToken", "test-refresh-token");
  });
}

async function mockBootstrapApis(page: Page, capabilities: CapabilitySet) {
  await page.route("**/api/v1/meta/auth-providers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        appName: "Basic System Template",
        appIcon: "",
        localRegistrationEnabled: true,
        profilePropertyCatalog: [],
        providers: [],
      }),
    });
  });

  await page.route("**/api/v1/auth/refresh", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
      }),
    });
  });

  await page.route("**/api/v1/users/me", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "user-1",
          username: "superuser",
          displayName: "Super User",
          email: "superuser@example.com",
          preferences: {},
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route("**/api/v1/auth/admin-capabilities", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...capabilities,
        effectiveRoles: ["Superuser"],
      }),
    });
  });
}

test("Superuser can view and create OAuth clients", async ({ page }) => {
  await seedSession(page);
  await mockBootstrapApis(page, SUPERUSER_CAPABILITIES);

  const clients: Array<{
    id: string;
    clientId: string;
    name: string;
    redirectUris: string[];
    allowedScopes: string[];
    grantTypes: string[];
    trusted: boolean;
    tokenEndpointAuthMethod: string;
    createdAt: string;
    updatedAt: string;
  }> = [
    {
      id: "1",
      clientId: "client_existing",
      name: "Existing App",
      redirectUris: ["https://existing.example.com/callback"],
      allowedScopes: ["openid", "profile"],
      grantTypes: ["authorization_code", "refresh_token"],
      trusted: false,
      tokenEndpointAuthMethod: "none",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ];

  await page.route("**/api/v1/admin/oauth/clients", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: clients }),
      });
      return;
    }

    if (method === "POST") {
      const payload = route.request().postDataJSON() as {
        name: string;
        redirectUris: string[];
        allowedScopes: string[];
        grantTypes?: string[];
        trusted: boolean;
        tokenEndpointAuthMethod: "none" | "client_secret_post";
      };
      const created = {
        id: String(clients.length + 1),
        clientId: `client_${clients.length + 1}`,
        name: payload.name,
        redirectUris: payload.redirectUris,
        allowedScopes: payload.allowedScopes,
        grantTypes: payload.grantTypes || ["authorization_code", "refresh_token"],
        trusted: payload.trusted,
        tokenEndpointAuthMethod: payload.tokenEndpointAuthMethod,
        createdAt: "2026-03-05T00:00:00Z",
        updatedAt: "2026-03-05T00:00:00Z",
      };
      clients.push(created);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(created),
      });
      return;
    }

    await route.continue();
  });

  await page.goto("/settings/admin/oauth/clients");
  await expect(page.getByRole("heading", { name: "OAuth Clients" })).toBeVisible();
  await expect(page.getByText("Existing App", { exact: true })).toBeVisible();

  await page.getByLabel("Name").fill("New OAuth App");
  await page.getByRole("button", { name: "Create OAuth Client" }).click();

  await expect(page.getByText("Client created", { exact: true })).toBeVisible();
  await expect(page.getByText("New OAuth App", { exact: true })).toBeVisible();
});
