import { chooseAccount, expect, test } from "./fixtures";

test.describe("keyboard & accessibility", () => {
  test("first Tab reaches the skip link, which moves focus to main content", async ({ page }) => {
    await page.goto("/en");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("demo account cards are keyboard-selectable", async ({ page }) => {
    await page.goto("/en");
    const card = page.locator('[data-account="demo-hall-01"]');
    await card.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/en\/hall$/);
  });

  test("account switcher: opens, closes with Escape returning focus, and switches role", async ({ page }) => {
    await chooseAccount(page, "en", "demo-hall-01");
    await expect(page).toHaveURL(/\/en\/hall$/);
    const trigger = page.getByRole("button", { name: /Switch demo account/ }).filter({ visible: true });
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page.getByRole("button", { name: /Judges/ }).click();
    await expect(page).toHaveURL(/\/en\/judge$/);
  });
});

test.describe("mobile navigation drawer", () => {
  test("opens from the start side, closes with Escape", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "drawer exists below 1024px only");
    await chooseAccount(page, "ar", "demo-hall-01");
    await expect(page).toHaveURL(/\/ar\/hall$/);
    const open = page.getByRole("button", { name: "فتح القائمة" });
    await open.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // RTL: start side is the right edge.
    const box = await dialog.boundingBox();
    const width = page.viewportSize()!.width;
    expect(Math.round(box!.x + box!.width)).toBe(width);
    await expect(dialog.getByRole("link", { name: "الرئيسية" })).toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
  });
});
