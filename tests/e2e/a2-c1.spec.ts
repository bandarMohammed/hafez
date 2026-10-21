import { KEYS, chooseAccount, expect, expectNoHorizontalScroll, test } from "./fixtures";

test.describe("A2 → C1 (approved first flow)", () => {
  test("Arabic: Continue as hall manager opens the hall home", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/ar$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1, name: "اختر حسابًا تجريبيًا" })).toBeVisible();

    // Six demo accounts; hall manager pre-selected (Figma A2).
    await expect(page.locator("[data-account]")).toHaveCount(6);
    await expect(page.locator('[data-account="demo-hall-01"]')).toHaveAttribute("aria-current", "true");
    await expectNoHorizontalScroll(page);

    await page.getByRole("button", { name: "متابعة كـمسؤول القاعة" }).click();
    await expect(page).toHaveURL(/\/ar\/hall$/);
    await expect(page.getByRole("heading", { level: 1, name: "أهلًا، قاعة النخيل التجريبية" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("English: clicking the hall card opens C1 with derived metrics and own events only", async ({ page }) => {
    await chooseAccount(page, "en", "demo-hall-01");
    await expect(page).toHaveURL(/\/en\/hall$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { level: 1, name: "Welcome, Al Nakheel Demo Hall" })).toBeVisible();

    const main = page.locator("main");
    // Metrics computed from seed records: 3 events, 1 awaiting a charity, 0 completed handovers.
    const expected: [value: string, label: string][] = [
      ["3", "My hall's events"],
      ["1", "Awaiting a charity"],
      ["0", "Completed handovers"],
    ];
    for (const [value, label] of expected) {
      await expect(main.getByText(label, { exact: true }).first()).toBeVisible();
      await expect(main.getByText(label, { exact: true }).first().locator("xpath=preceding-sibling::span")).toHaveText(
        value,
      );
    }

    // Own events only (E-105, E-106, E-108 belong to other halls).
    for (const id of ["E-104", "E-107", "E-103"])
      await expect(main.getByText(id).filter({ visible: true }).first()).toBeVisible();
    for (const id of ["E-101", "E-105", "E-106", "E-108"]) await expect(main.getByText(id)).toHaveCount(0);

    // Editable statuses get "Edit", locked ones get "View" (central can()).
    await expect(page.getByRole("link", { name: "Edit Wedding (demo) · E-104" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit Reception (demo) · E-107" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View Wedding (demo) · E-103" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("session survives reload and language switch keeps the same screen", async ({ page }) => {
    await chooseAccount(page, "ar", "demo-hall-01");
    await expect(page).toHaveURL(/\/ar\/hall$/);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("أهلًا، قاعة النخيل التجريبية");

    await page.locator('a[lang="en"]:visible').first().click();
    await expect(page).toHaveURL(/\/en\/hall$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome, Al Nakheel Demo Hall");
  });

  test("an unbuilt role gets an explicit under-development page, not a fake dashboard", async ({ page }) => {
    // Admin (B) stays unbuilt while the proposed B + F merge awaits the owner's approval.
    await chooseAccount(page, "en", "demo-admin");
    await expect(page).toHaveURL(/\/en\/admin$/);
    await expect(
      page.getByRole("heading", { name: "The Platform admin workspace is under development" }),
    ).toBeVisible();
    await expect(page.getByText("Under development").first()).toBeVisible();
    await page.getByRole("link", { name: "Back to choose account" }).click();
    await expect(page).toHaveURL(/\/en$/);
  });

  test("seeded data is written only under the app's own keys", async ({ page }) => {
    await chooseAccount(page, "en", "demo-hall-01");
    const keys = await page.evaluate(() => Object.keys(localStorage).sort());
    expect(keys).toEqual([KEYS.data, KEYS.session].sort());
  });
});
