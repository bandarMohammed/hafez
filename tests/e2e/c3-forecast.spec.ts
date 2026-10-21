import type { Page } from "@playwright/test";
import { KEYS, chooseAccount, expect, expectNoHorizontalScroll, test } from "./fixtures";

/** Creates the Figma scenario event (300 guests, 210 kg) via C2 and lands on its C3 forecast. */
async function scenarioForecast(page: Page, locale: "ar" | "en") {
  await chooseAccount(page, locale, "demo-hall-01");
  await expect(page).toHaveURL(new RegExp(`/${locale}/hall$`));
  await page.goto(`/${locale}/hall/events/new`);
  await page.locator("#ne-title").fill("Wedding (demo scenario)");
  await page.locator("#ne-date").selectOption({ index: 10 });
  await page.locator("#ne-guests").fill("300");
  await page.locator("#ne-endTime").selectOption("23:00");
  await page.locator("#ne-readyTime").selectOption("23:30");
  await page.locator("#ne-foodTypes").click();
  await page.locator('#ne-foodTypes ~ div input[type="checkbox"]').first().check();
  await page.keyboard.press("Escape");
  await page.locator("#ne-plannedKg").fill("210");
  await page.locator("#ne-contactPhone").fill("0500000000");
  await page.locator('button[value="forecast"]').click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/hall/events/E-109/forecast$`));
}

const storedEvent = (page: Page) =>
  page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!).events.find((e: { id: string }) => e.id === "E-109"),
    KEYS.data,
  );

test.describe("C3 — surplus forecast & recommendation", () => {
  test("Arabic: shows the Figma scenario numbers and the rule step by step", async ({ page }, testInfo) => {
    await scenarioForecast(page, "ar");
    await expect(page.getByRole("heading", { level: 1, name: "توقع الفائض والتوصية قبل النشر — E-109" })).toBeVisible();
    const main = page.getByRole("main");
    for (const text of ["300", "210 كجم", "180 كجم", "30 كجم"])
      await expect(main.getByText(text, { exact: true }).first()).toBeVisible();
    await expect(main.getByText("فائض متوقع بعد التوصية ≈ 15 عبوة × 2 كجم")).toBeVisible();
    await expect(main.getByText("300 ضيف × 0.5 كجم لكل ضيف (افتراض توضيحي)")).toBeVisible();
    await expect(main.getByText("150 كجم × 1.2 (هامش أمان 20%)")).toBeVisible();
    await expect(main.getByText("180 − 150 = 30 كجم = 15 عبوة ممتلئة × 2 كجم")).toBeVisible();
    await expect(main.getByText("210 − 150 = 60 كجم متوقعة (خط الأساس الافتراضي في التقرير)")).toBeVisible();
    // A pure-number line reads left-to-right like Figma ("210 − 180").
    await expect(main.getByText("210 − 180", { exact: true })).toHaveAttribute("dir", "auto");
    if (testInfo.project.name === "laptop")
      await expect(page.getByRole("complementary").getByRole("link", { name: "مناسبة جديدة" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    await expectNoHorizontalScroll(page);
  });

  test("Keep 210 kg publishes with the planned quantity and a 60 kg estimate", async ({ page }) => {
    await scenarioForecast(page, "en");
    await page.getByRole("button", { name: "Keep 210 kg" }).click();
    await expect(page).toHaveURL(/\/en\/hall$/);
    await expect(
      page.getByText("210 kg approved · expected surplus ≈ 60 kg (estimate).", { exact: false }),
    ).toBeVisible();
    expect(await storedEvent(page)).toMatchObject({
      status: "available",
      plannedQuantityKg: 210,
      expectedSurplusKg: 60,
      forecast: { decision: "keep_planned", recommendedKg: 180, plannedKgBefore: 210 },
    });
    await expect(page.getByRole("main").getByText("60 kg (estimate)").filter({ visible: true }).first()).toBeVisible();
  });

  test("Adjust assumptions recalculates live, blocks invalid values, and is saved with the decision", async ({
    page,
  }) => {
    await scenarioForecast(page, "en");
    const adjust = page.getByRole("button", { name: "Adjust assumptions" });
    await adjust.click();
    await expect(page.getByRole("button", { name: "Hide assumptions" })).toHaveAttribute("aria-expanded", "true");

    await page.getByLabel("Consumption per guest (kg)").fill("0.6");
    await page.getByLabel("Safety margin (%)").fill("10");
    await expect(page.getByRole("button", { name: "Use 198 kg & make available" })).toBeEnabled();
    await expect(page.getByText("198 − 180 = 18 kg = 9 full boxes × 2 kg")).toBeVisible();

    await page.getByLabel("Safety margin (%)").fill("90");
    await expect(page.getByText("Enter a percentage between 0 and 50")).toBeVisible();
    await expect(page.getByLabel("Safety margin (%)")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("button", { name: /make available/ })).toBeDisabled();

    await page.getByLabel("Safety margin (%)").fill("10");
    await page.getByRole("button", { name: "Use 198 kg & make available" }).click();
    await expect(page).toHaveURL(/\/en\/hall$/);
    expect(await storedEvent(page)).toMatchObject({
      plannedQuantityKg: 198,
      expectedSurplusKg: 18,
      forecast: { kgPerGuest: 0.6, safetyMargin: 0.1, decision: "use_recommended" },
    });
  });

  test("Restore defaults brings back 0.5 kg and 20%", async ({ page }) => {
    await scenarioForecast(page, "en");
    await page.getByRole("button", { name: "Adjust assumptions" }).click();
    await page.getByLabel("Consumption per guest (kg)").fill("0.7");
    await page.getByRole("button", { name: "Restore defaults" }).click();
    await expect(page.getByLabel("Consumption per guest (kg)")).toHaveValue("0.5");
    await expect(page.getByRole("button", { name: "Use 180 kg & make available" })).toBeVisible();
  });

  test("after deciding, the forecast can't be applied again", async ({ page }) => {
    await scenarioForecast(page, "en");
    await page.getByRole("button", { name: "Use 180 kg & make available" }).click();
    await expect(page).toHaveURL(/\/en\/hall$/);
    await page.goto("/en/hall/events/E-109/forecast");
    await expect(page.getByRole("heading", { name: "The forecast for this event was already decided" })).toBeVisible();
    await expect(page.getByRole("button", { name: /make available/ })).toHaveCount(0);
  });

  test("seed events without C2 data and unknown ids get honest states", async ({ page }) => {
    await chooseAccount(page, "en", "demo-hall-01");
    await expect(page).toHaveURL(/\/en\/hall$/);
    await page.goto("/en/hall/events/E-107/forecast");
    await expect(page.getByRole("heading", { name: "The forecast isn't available for this event" })).toBeVisible();
    await page.goto("/en/hall/events/E-106/forecast"); // another hall's event
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("leaving C3 without deciding keeps the event registered (not published)", async ({ page }) => {
    await scenarioForecast(page, "en");
    await page.goto("/en/hall");
    expect((await storedEvent(page)).status).toBe("registered");
    await expect(page.getByRole("main").getByText("Registered").filter({ visible: true }).first()).toBeVisible();
  });
});
