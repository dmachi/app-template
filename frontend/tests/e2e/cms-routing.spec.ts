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

  await page.route("**/api/v1/cms/page/demo-id", async (route) => {
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
        canonicalUrl: "/cms/page/demo-id",
        visibility: "public",
        preview: false,
      }),
    });
  });

  await page.goto("/cms/page/demo-id");
  await expect(page.getByRole("heading", { name: "Demo CMS Page" })).toBeVisible();
});

test("/cms/:type/:id rewrites to canonical typed url when provided", async ({ page }) => {
  await mockAuthProviders(page);

  await page.route("**/api/v1/cms/page/demo-id", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        content: {
          id: "demo-id",
          contentTypeKey: "page",
          name: "Canonical Page",
          content: "# Canonical Page",
          additionalFields: {},
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
        canonicalUrl: "/cms/page/demo-id",
        visibility: "public",
        preview: false,
      }),
    });
  });

  await page.route("**/api/v1/cms/article/demo-id", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "CONTENT_NOT_FOUND", message: "Content not found" },
      }),
    });
  });

  await page.goto("/cms/article/demo-id");
  await expect(page).toHaveURL(/\/cms\/article\/demo-id$/);
  await page.goto("/cms/page/demo-id");
  await expect(page).toHaveURL(/\/cms\/page\/demo-id$/);
  await expect(page.getByRole("heading", { name: "Canonical Page" }).first()).toBeVisible();
});

test("unmatched path renders fallback 404", async ({ page }) => {
  await mockAuthProviders(page);

  await page.goto("/about-us");
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
});

test("blacklisted path does not call resolver and renders 404", async ({ page }) => {
  await mockAuthProviders(page);

  await page.goto("/api/blocked-path");
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
});

test("explicit app route is never shadowed by resolver fallback", async ({ page }) => {
  await mockAuthProviders(page);

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
});

test("resolver-rendered markdown is sanitized and does not execute scripts", async ({ page }) => {
  await mockAuthProviders(page);

  await page.route("**/api/v1/cms/page/xss-id", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        content: {
          id: "xss-id",
          contentTypeKey: "page",
          name: "Sanitized Page",
          content: "<script>window.__cms_xss_marker = 1</script>\n# Safe Title",
          additionalFields: {},
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
        canonicalUrl: "/cms/page/xss-id",
        visibility: "public",
        preview: false,
      }),
    });
  });

  await page.goto("/cms/page/xss-id");
  await expect(page.getByRole("heading", { name: "Sanitized Page" })).toBeVisible();

  const scriptCount = await page.locator(".markdown-content script").count();
  expect(scriptCount).toBe(0);

  const marker = await page.evaluate(() => (window as unknown as { __cms_xss_marker?: number }).__cms_xss_marker);
  expect(marker).toBeUndefined();
});
