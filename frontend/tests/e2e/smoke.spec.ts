import { expect, test } from "@playwright/test";

test("home and login views render", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await expect(page.getByText("Lorem ipsum")).toBeVisible();

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();

  const passwordInputCount = await page.locator('input[type="password"]').count();
  const noProvidersCount = await page.getByText("No authentication providers are enabled.").count();
  const authOptionsErrorCount = await page.getByText("Unable to load auth options").count();
  expect(passwordInputCount + noProvidersCount + authOptionsErrorCount).toBeGreaterThan(0);
});
