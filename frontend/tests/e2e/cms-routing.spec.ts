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

test("/cms/:id rewrites to canonical alias when provided", async ({ page }) => {
  await mockAuthProviders(page);

  await page.route("**/api/v1/cms/demo-id", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        content: {
          id: "demo-id",
          contentTypeKey: "page",
          name: "Canonical Page",
          content: "# Canonical Alias",
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
        preview: false,
      }),
    });
  });

  await page.route("**/api/v1/cms/resolve?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        matched: true,
        content: {
          id: "demo-id",
          contentTypeKey: "page",
          name: "Canonical Page",
          content: "# Canonical Alias",
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

  await page.goto("/cms/demo-id");
  await expect(page).toHaveURL(/\/about-us$/);
  await expect(page.getByRole("heading", { name: "Canonical Page" })).toBeVisible();
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

test("resolver-rendered markdown is sanitized and does not execute scripts", async ({ page }) => {
  await mockAuthProviders(page);

  await page.route("**/api/v1/cms/resolve?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        matched: true,
        content: {
          id: "xss-id",
          contentTypeKey: "page",
          name: "Sanitized Page",
          content: "<script>window.__cms_xss_marker = 1</script>\n# Safe Title",
          additionalFields: {},
          aliasPath: "/sanitized",
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
        canonicalUrl: "/sanitized",
        visibility: "public",
      }),
    });
  });

  await page.goto("/sanitized");
  await expect(page.getByRole("heading", { name: "Sanitized Page" })).toBeVisible();

  const scriptCount = await page.locator(".markdown-content script").count();
  expect(scriptCount).toBe(0);

  const marker = await page.evaluate(() => (window as unknown as { __cms_xss_marker?: number }).__cms_xss_marker);
  expect(marker).toBeUndefined();
});
