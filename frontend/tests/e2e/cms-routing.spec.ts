import { expect, test, type Page } from "@playwright/test";

async function mockAuthProviders(page: Page) {
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
}

test("/cms/:id uses id endpoint and never calls resolver", async ({ page }) => {
  await mockAuthProviders(page);

  let resolverCalls = 0;
  await page.route("**/api/v1/cms/resolve?**", async (route) => {
    resolverCalls += 1;
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "Not found" } }),
    });
  });

  await page.route("**/api/v1/cms/demo-id", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        content: {
          id: "demo-id",
          contentTypeKey: "page",
          name: "Demo CMS Page",
          content: "# Hello CMS",
          additionalFields: {},
          aliasPath: null,
          status: "published",
          visibility: "public",
          allowedRoles: [],
          layoutKey: null,
          linkRefs: [],
          createdByUserId: "system",
          updatedByUserId: "system",
          publishedAt: null,
          publishedByUserId: null,
          createdAt: null,
          updatedAt: null,
        },
        canonicalUrl: null,
        visibility: "public",
        preview: false,
      }),
    });
  });

  await page.goto("/cms/demo-id");
  await expect(page.getByRole("heading", { name: "Demo CMS Page" })).toBeVisible();
  expect(resolverCalls).toBe(0);
});

test("unmatched non-blacklisted path calls resolver and renders content", async ({ page }) => {
  await mockAuthProviders(page);

  let resolverCalls = 0;
  await page.route("**/api/v1/cms/resolve?**", async (route) => {
    resolverCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        matched: true,
        content: {
          id: "resolved-id",
          contentTypeKey: "page",
          name: "Resolved Alias Page",
          content: "# Alias Resolved",
          additionalFields: {},
          aliasPath: "/about-us",
          status: "published",
          visibility: "public",
          allowedRoles: [],
          layoutKey: null,
          linkRefs: [],
          createdByUserId: "system",
          updatedByUserId: "system",
          publishedAt: null,
          publishedByUserId: null,
          createdAt: null,
          updatedAt: null,
        },
        canonicalUrl: "/about-us",
        visibility: "public",
      }),
    });
  });

  await page.goto("/about-us");
  await expect(page.getByRole("heading", { name: "Resolved Alias Page" })).toBeVisible();
  expect(resolverCalls).toBe(1);
});

test("blacklisted path does not call resolver and renders 404", async ({ page }) => {
  await mockAuthProviders(page);

  let resolverCalls = 0;
  await page.route("**/api/v1/cms/resolve?**", async (route) => {
    resolverCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ matched: true }),
    });
  });

  await page.goto("/api/blocked-path");
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  expect(resolverCalls).toBe(0);
});

test("explicit app route is never shadowed by resolver fallback", async ({ page }) => {
  await mockAuthProviders(page);

  let resolverCalls = 0;
  await page.route("**/api/v1/cms/resolve?**", async (route) => {
    resolverCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ matched: true }),
    });
  });

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
  expect(resolverCalls).toBe(0);
});
