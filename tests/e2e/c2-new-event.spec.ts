import type { Page } from "@playwright/test";
import { KEYS, chooseAccount, expect, expectNoHorizontalScroll, test } from "./fixtures";

async function openNewEvent(page: Page, locale: "ar" | "en") {
  await chooseAccount(page, locale, "demo-hall-01");
  await expect(page).toHaveURL(new RegExp(`/${locale}/hall$`));
  await page
    .getByRole("main")
    .getByRole("link", { name: locale === "ar" ? "مناسبة جديدة" : "New event" })
    .click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/hall/events/new$`));
}

/** Fills the Figma scenario (300 guests, 210 kg, ends 23:00, ready 23:30). Date = 10th option. */
async function fillScenario(page: Page, opts: { readyTime?: boolean; foodTypes?: string[] } = {}) {
  await page.locator("#ne-title").fill("Wedding (demo scenario)");
  await page.locator("#ne-date").selectOption({ index: 10 });
  await page.locator("#ne-guests").fill("300");
  await page.locator("#ne-endTime").selectOption("23:00");
  if (opts.readyTime !== false) await page.locator("#ne-readyTime").selectOption("23:30");
  for (const type of opts.foodTypes ?? []) {
    await page.locator("#ne-foodTypes").click();
    await page.getByRole("checkbox", { name: type }).check();
    await page.keyboard.press("Escape");
  }
  await page.locator("#ne-plannedKg").fill("210");
  await page.locator("#ne-contactPhone").fill("0500000000");
}

test.describe("C2 — register a new event", () => {
  test("Arabic: saving with missing fields shows the Figma error state and changes nothing", async ({
    page,
  }, testInfo) => {
    await openNewEvent(page, "ar");
    await expect(page.getByRole("heading", { level: 1, name: "تسجيل مناسبة جديدة" })).toBeVisible();
    // Sidebar marks the current screen (on mobile the sidebar lives in the closed drawer).
    if (testInfo.project.name === "laptop")
      await expect(page.getByRole("complementary").getByRole("link", { name: "مناسبة جديدة" })).toHaveAttribute(
        "aria-current",
        "page",
      );

    await fillScenario(page, { readyTime: false });
    await page.getByRole("button", { name: "حفظ وإتاحتها للتنسيق" }).click();

    const summary = page.getByRole("group", { name: "لم تُحفظ المناسبة" });
    await expect(summary).toBeFocused();
    await expect(summary).toContainText("أكمل حقلين مطلوبين: وقت جاهزية الطعام ونوع الطعام المتوقع. لم تتغير الحالة.");
    await expect(page.locator("#ne-readyTime")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#ne-readyTime-error")).toHaveText(
      "حدّد وقت جاهزية الطعام — حقل مستقل عن وقت انتهاء المناسبة",
    );
    await expect(page.locator("#ne-foodTypes-error")).toHaveText("اختر نوعًا واحدًا على الأقل");
    await expect(page).toHaveURL(/\/ar\/hall\/events\/new$/);
    await expectNoHorizontalScroll(page);

    // Nothing was stored.
    const count = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).events.length, KEYS.data);
    expect(count).toBe(8);

    // Errors update live: fixing one field leaves exactly one in the summary.
    await page.locator("#ne-readyTime").selectOption("23:30");
    await expect(summary).toContainText("أكمل حقلًا مطلوبًا: نوع الطعام المتوقع.");
  });

  test("English: Save & make available → E-109 (registered) → C3 → publish → C1 with confirmation", async ({
    page,
  }) => {
    await openNewEvent(page, "en");
    await fillScenario(page, { foodTypes: ["Hot meals", "Desserts"] });
    await expect(page.locator("#ne-foodTypes")).toContainText("Hot meals, Desserts");
    await page.getByRole("button", { name: "Save & make available" }).click();

    // Figma prototype: C2 → C3. The event exists but is not published until the hall decides.
    await expect(page).toHaveURL(/\/en\/hall\/events\/E-109\/forecast$/);
    const status = await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)!).events.find((e: { id: string }) => e.id === "E-109").status,
      KEYS.data,
    );
    expect(status).toBe("registered");
    await page.getByRole("button", { name: "Use 180 kg & make available" }).click();

    await expect(page).toHaveURL(/\/en\/hall$/);
    const banner = page.getByRole("status").filter({ hasText: "Event E-109 is now available" });
    await expect(banner).toBeVisible();
    await expect(banner).toBeFocused();

    const main = page.getByRole("main");
    await expect(main.getByText("E-109").filter({ visible: true }).first()).toBeVisible();
    await expect(
      main.getByText("My hall's events", { exact: true }).first().locator("xpath=preceding-sibling::span"),
    ).toHaveText("4");
    await expect(page.getByRole("link", { name: "Edit Wedding (demo scenario) · E-109" })).toBeVisible();

    // Persisted; the confirmation is one-time only.
    await page.reload();
    await expect(main.getByText("E-109").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("Event E-109 is now available")).toHaveCount(0);

    // The new event's links work (client-checked id), e.g. Edit → under development.
    await page.getByRole("link", { name: "Edit Wedding (demo scenario) · E-109" }).click();
    await expect(page.getByRole("heading", { name: "“Edit event E-109” is under development" })).toBeVisible();
  });

  test("Save as registered keeps the event hidden from charities", async ({ page }) => {
    await openNewEvent(page, "en");
    await fillScenario(page, { foodTypes: ["Rice dishes"] });
    await page.getByRole("button", { name: "Save as registered" }).click();
    await expect(page.getByText("Event E-109 saved as “Registered”")).toBeVisible();
    await expect(page.getByText("Charities won't see it until it's made available.")).toBeVisible();
    const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), KEYS.data);
    const event = stored.events.find((e: { id: string }) => e.id === "E-109");
    expect(event).toMatchObject({ status: "registered", expectedGuests: 300, plannedQuantityKg: 210 });
    expect(event.foodReadyAt).toMatch(/T23:30:00\+03:00$/);
    expect(stored.activity.at(-1)).toMatchObject({ action: "event.created", entityId: "E-109", after: "registered" });
  });

  test("Cancel returns to C1 without saving", async ({ page }) => {
    await openNewEvent(page, "en");
    await page.locator("#ne-title").fill("Draft that should not be saved");
    await page.getByRole("link", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/\/en\/hall$/);
    await expect(page.getByText("Draft that should not be saved")).toHaveCount(0);
  });

  test("food type picker works with the keyboard", async ({ page }) => {
    await openNewEvent(page, "en");
    const trigger = page.locator("#ne-foodTypes");
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("checkbox", { name: "Hot meals" })).toBeFocused();
    await page.keyboard.press("Space");
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
    await expect(trigger).toContainText("Hot meals");
  });

  test("an unknown event id shows the not-found state", async ({ page }) => {
    await chooseAccount(page, "en", "demo-hall-01");
    await expect(page).toHaveURL(/\/en\/hall$/);
    await page.goto("/en/hall/events/E-999");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });
});
