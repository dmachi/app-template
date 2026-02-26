import { expect, test } from "@playwright/test";

test("login view renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Basic System Template" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
  await expect(page.getByLabel("Username or Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
});
