import { KEYS, chooseAccount, expect, test } from "./fixtures";

test.describe("guarded states", () => {
  test("no session: hall workspace asks to choose an account", async ({ page }) => {
    await page.goto("/en/hall");
    await expect(page.getByRole("heading", { name: "Choose a demo account first" })).toBeVisible();
    await page.getByRole("link", { name: "Choose an account" }).click();
    await expect(page).toHaveURL(/\/en$/);
  });

  test("another role opening /hall gets access denied with a way out", async ({ page }) => {
    await chooseAccount(page, "en", "demo-charity-01");
    await expect(page).toHaveURL(/\/en\/charity$/);
    await page.goto("/en/hall");
    await expect(page.getByRole("heading", { name: "You don't have access to this page" })).toBeVisible();
    await expect(page.getByText("(Charity coordinator)")).toBeVisible();
    await page.getByRole("link", { name: "Go to my workspace" }).click();
    await expect(page).toHaveURL(/\/en\/charity$/);
  });

  test("hall manager cannot open another role's workspace", async ({ page }) => {
    await chooseAccount(page, "ar", "demo-hall-01");
    await expect(page).toHaveURL(/\/ar\/hall$/);
    await page.goto("/ar/admin");
    await expect(page.getByRole("heading", { name: "لا تملك صلاحية دخول هذه الصفحة" })).toBeVisible();
  });

  test("corrupted local data shows an error with a working reset", async ({ page }) => {
    await chooseAccount(page, "en", "demo-hall-01");
    await expect(page).toHaveURL(/\/en\/hall$/);
    await page.evaluate((key) => localStorage.setItem(key, "{corrupted"), KEYS.data);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Couldn't read the demo data" })).toBeVisible();
    await page.getByRole("button", { name: "Reset demo data" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Welcome, Al Nakheel Demo Hall" })).toBeVisible();
  });

  test("a hall with no events shows the empty state", async ({ page }) => {
    await chooseAccount(page, "en", "demo-hall-01");
    await expect(page).toHaveURL(/\/en\/hall$/);
    await page.evaluate((key) => {
      const data = JSON.parse(localStorage.getItem(key)!);
      data.events = data.events.filter((e: { hallId: string }) => e.hallId !== "hall-nakheel");
      localStorage.setItem(key, JSON.stringify(data));
    }, KEYS.data);
    await page.reload();
    await expect(page.getByRole("heading", { name: "No events for your hall yet" })).toBeVisible();
    await expect(page.getByText("No activity recorded yet.")).toBeVisible();
  });
});

test.describe("routes", () => {
  test("Edit on an event opens an honest under-development screen", async ({ page }) => {
    await chooseAccount(page, "en", "demo-hall-01");
    await page.getByRole("link", { name: "Edit Wedding (demo) · E-104" }).click();
    await expect(page).toHaveURL(/\/en\/hall\/events\/E-104\/edit$/);
    await expect(page.getByRole("heading", { name: "“Edit event E-104” is under development" })).toBeVisible();
    await page.getByRole("link", { name: "Back to home" }).click();
    await expect(page).toHaveURL(/\/en\/hall$/);
  });

  test("unknown paths render the localized 404", async ({ page }) => {
    const res = await page.goto("/en/hall/not-a-screen");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

    const res2 = await page.goto("/ar/does-not-exist/deeper");
    expect(res2?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible();
  });
});
