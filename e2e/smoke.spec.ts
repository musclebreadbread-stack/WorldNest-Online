import { test, expect } from "@playwright/test";

/**
 * Smoke coverage for the three things only a real browser can confirm: the
 * landing page renders, the middleware guards `/game`, and the auth page toggles
 * between its two modes. Everything below the UI is covered by Vitest.
 */

test("landing page renders the title and a play link", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "WorldNest Online" })).toBeVisible();

  const playLink = page.getByRole("link", { name: /play now|loading/i });
  await expect(playLink).toBeVisible();
  // Signed out, the call to action sends you to authentication first
  await expect(playLink).toHaveAttribute("href", "/auth");
});

test("game route redirects to auth when signed out", async ({ page }) => {
  await page.goto("/game");

  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
});

test("auth page toggles between sign in and sign up", async ({ page }) => {
  await page.goto("/auth");

  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  await expect(page.getByText("Sign in to your account")).toBeVisible();
  // The username field only exists on the sign-up form
  await expect(page.getByPlaceholder("Choose a username")).toBeHidden();

  await page.getByRole("button", { name: /don't have an account/i }).click();

  await expect(page.getByRole("button", { name: "Sign Up" })).toBeVisible();
  await expect(page.getByText("Create a new account")).toBeVisible();
  await expect(page.getByPlaceholder("Choose a username")).toBeVisible();

  await page.getByRole("button", { name: /already have an account/i }).click();

  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
});
