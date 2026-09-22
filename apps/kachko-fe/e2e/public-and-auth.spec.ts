import { expect, test } from "@playwright/test";

test("landing page exposes the primary journeys", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Kachko/);
  await expect(page.getByRole("link", { name: /create|start|claim/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /log in/i }).first()).toBeVisible();
});

test("login validates credentials without calling the API", async ({ page }) => {
  let loginRequests = 0;
  await page.route("**/api/v1/auth/login", async (route) => {
    loginRequests += 1;
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "UNEXPECTED", message: "should not be called" } }) });
  });
  await page.goto("/login");
  await page.getByLabel("Email address").fill("not-an-email");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: /^log in$/i }).click();
  expect(await page.getByLabel("Email address").evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
  expect(loginRequests).toBe(0);
});

test("authentication failure is rendered accessibly", async ({ page }) => {
  await page.route("**/api/v1/auth/login", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect" } }) });
  });
  await page.goto("/login");
  await page.getByLabel("Email address").fill("person@example.com");
  await page.getByLabel("Password").fill("correct-length-password");
  await page.getByRole("button", { name: /^log in$/i }).click();
  await expect(page.getByText("Email or password is incorrect")).toBeVisible();
});
