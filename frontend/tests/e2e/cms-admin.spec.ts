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

const CONTENT_EDITOR_CAPABILITIES: CapabilitySet = {
  anyAdmin: true,
  users: false,
  groups: false,
  invitations: false,
  roles: false,
  content: true,
  contentTypes: false,
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

const NON_CONTENT_EDITOR_CAPABILITIES: CapabilitySet = {
  anyAdmin: false,
  users: false,
  groups: false,
  invitations: false,
  roles: false,
  content: false,
  contentTypes: false,
};

async function seedSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("bst.refreshToken", "test-refresh-token");
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
          username: "content-editor",
          displayName: "Content Editor",
          email: "editor@example.com",
          preferences: { theme: "system" },
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
        effectiveRoles: capabilities.contentTypes ? ["superuser"] : capabilities.content ? ["ContentAdmin"] : ["member"],
      }),
    });
  });
}

async function mockCmsTypeList(page: Page) {
  await page.route("**/api/v1/content/types", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            key: "page",
            label: "Page",
            description: "Built-in page",
            status: "active",
            fieldDefinitions: [],
            permissionsPolicy: {},
            systemManaged: true,
            createdAt: null,
            updatedAt: null,
          },
        ],
      }),
    });
  });
}

test("ContentAdmin can access admin content list and editor", async ({ page }) => {
  await seedSession(page);
  await mockBootstrapApis(page, CONTENT_EDITOR_CAPABILITIES);
  await mockCmsTypeList(page);

  await page.route("**/api/v1/content", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "demo-id",
            contentTypeKey: "page",
            name: "Demo Draft",
            content: "# demo",
            additionalFields: {},
            aliasPath: "/demo",
            status: "draft",
            visibility: "public",
            allowedRoles: [],
            layoutKey: null,
            linkRefs: [],
            createdByUserId: "user-1",
            updatedByUserId: "user-1",
            publishedAt: null,
            publishedByUserId: null,
            createdAt: null,
            updatedAt: null,
          },
        ],
      }),
    });
  });

  await page.route("**/api/v1/content/demo-id", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "demo-id",
        contentTypeKey: "page",
        name: "Demo Draft",
        content: "# Demo",
        additionalFields: {},
        aliasPath: "/demo",
        status: "draft",
        visibility: "public",
        allowedRoles: [],
        layoutKey: null,
        linkRefs: [],
        createdByUserId: "user-1",
        updatedByUserId: "user-1",
        publishedAt: null,
        publishedByUserId: null,
        createdAt: null,
        updatedAt: null,
      }),
    });
  });

  await page.route("**/api/v1/media/images", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.goto("/settings/admin/content");
  await expect(page.getByRole("heading", { name: "Content" })).toBeVisible();

  await page.goto("/settings/admin/content/demo-id");
  await expect(page.getByRole("heading", { name: "Page Editor" })).toBeVisible();
});

test("Non-ContentAdmin is blocked from admin content routes", async ({ page }) => {
  await seedSession(page);
  await mockBootstrapApis(page, NON_CONTENT_EDITOR_CAPABILITIES);

  await page.goto("/settings/admin/content");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Section One" })).toBeVisible();
});

test("Superuser can access content types admin page", async ({ page }) => {
  await seedSession(page);
  await mockBootstrapApis(page, SUPERUSER_CAPABILITIES);
  await mockCmsTypeList(page);

  await page.goto("/settings/admin/content-types");
  await expect(page.getByRole("heading", { name: "Content Types" })).toBeVisible();
});

test("Draft save then publish flow updates status", async ({ page }) => {
  await seedSession(page);
  await mockBootstrapApis(page, CONTENT_EDITOR_CAPABILITIES);
  await mockCmsTypeList(page);

  await page.route("**/api/v1/media/images", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.route("**/api/v1/content/demo-id", async (route) => {
    const method = route.request().method();

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "demo-id",
          contentTypeKey: "page",
          name: "Draft Item",
          content: "# Draft",
          additionalFields: {},
          aliasPath: "/draft-item",
          status: "draft",
          visibility: "public",
          allowedRoles: [],
          layoutKey: null,
          linkRefs: [],
          createdByUserId: "user-1",
          updatedByUserId: "user-1",
          publishedAt: null,
          publishedByUserId: null,
          createdAt: null,
          updatedAt: null,
        }),
      });
      return;
    }

    if (method === "PATCH") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "demo-id",
          contentTypeKey: "page",
          name: "Draft Item",
          content: "# Draft",
          additionalFields: {},
          aliasPath: "/draft-item",
          status: "draft",
          visibility: "public",
          allowedRoles: [],
          layoutKey: null,
          linkRefs: [],
          createdByUserId: "user-1",
          updatedByUserId: "user-1",
          publishedAt: null,
          publishedByUserId: null,
          createdAt: null,
          updatedAt: null,
        }),
      });
      return;
    }

    await route.continue();
  });

  await page.route("**/api/v1/content/demo-id/publish", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "demo-id",
        contentTypeKey: "page",
        name: "Draft Item",
        content: "# Draft",
        additionalFields: {},
        aliasPath: "/draft-item",
        status: "published",
        visibility: "public",
        allowedRoles: [],
        layoutKey: null,
        linkRefs: [],
        createdByUserId: "user-1",
        updatedByUserId: "user-1",
        publishedAt: "2026-03-01T00:00:00Z",
        publishedByUserId: "user-1",
        createdAt: null,
        updatedAt: null,
      }),
    });
  });

  await page.goto("/settings/admin/content/demo-id");

  await expect(page.getByText("draft", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Save Draft" }).click();
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();
  await expect(page.getByText("published", { exact: true })).toBeVisible();
});

test("Superuser can create and edit content type definitions", async ({ page }) => {
  await seedSession(page);
  await mockBootstrapApis(page, SUPERUSER_CAPABILITIES);

  const items: any[] = [
    {
      key: "page",
      label: "Page",
      description: "Built-in page",
      status: "active",
      fieldDefinitions: [],
      permissionsPolicy: {},
      systemManaged: true,
      createdAt: null,
      updatedAt: null,
    },
  ];

  await page.route("**/api/v1/content/types", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items }),
    });
  });

  await page.route("**/api/v1/admin/content/types", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    const body = route.request().postDataJSON() as any;
    const created = {
      key: body.key,
      label: body.label,
      description: body.description || null,
      status: "active",
      fieldDefinitions: body.fieldDefinitions || [],
      permissionsPolicy: body.permissionsPolicy || {},
      systemManaged: false,
      createdAt: null,
      updatedAt: null,
    };
    items.push(created);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(created),
    });
  });

  await page.route("**/api/v1/admin/content/types/*", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }

    const key = route.request().url().split("/").pop() || "";
    const body = route.request().postDataJSON() as any;
    const index = items.findIndex((item) => item.key === key);
    if (index >= 0) {
      items[index] = {
        ...items[index],
        ...body,
        updatedAt: null,
      };
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(items[index]),
    });
  });

  await page.goto("/settings/admin/content-types");

  await page.getByRole("button", { name: "Add Content Type" }).click();
  await page.getByPlaceholder("e.g. Article").fill("Article");
  await page.getByPlaceholder("What this content type is for").fill("Article pages");
  await page.getByRole("button", { name: "Create", exact: true }).click();

  await expect(page.getByText("Created", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/admin\/content-types\/article$/);

  await page.getByRole("button", { name: "Add Field" }).click();
  await page.getByPlaceholder("key").last().fill("summary");
  await page.getByPlaceholder("label").last().fill("Summary");

  const saveDefinitionButton = page.getByRole("button", { name: "Save Definition" }).first();
  await expect(saveDefinitionButton).toBeVisible();
  await saveDefinitionButton.click();

  await expect(page.getByText("Definition saved", { exact: true })).toBeVisible();
});
