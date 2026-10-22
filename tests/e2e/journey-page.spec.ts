import type { Page } from "@playwright/test";
import { KEYS, expect, expectNoHorizontalScroll, test } from "./fixtures";

const stored = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), KEYS.data);
const metric = (page: Page, label: string) =>
  page
    .getByRole("region", { name: /الأثر الآن|Impact now/ })
    .locator("div")
    .filter({ hasText: label })
    .first();

test.describe("Hafez journey page (pitch)", () => {
  test("A2 entry → step by step → whole journey → numbers and records update", async ({ page }) => {
    await page.goto("/ar");
    await page.getByRole("link", { name: "افتح رحلة حفيظ" }).click();
    await expect(page).toHaveURL(/\/ar\/journey$/);
    await expect(page.getByRole("heading", { level: 1, name: "من فائض المناسبة إلى أثر يُقاس" })).toBeVisible();
    await expect(page.getByText("0 من 6 خطوات مكتملة")).toBeVisible();
    await expect(metric(page, "مناسبات مسجلة")).toContainText("8");
    await expect(metric(page, "مستلم فعليًا من القاعات")).toContainText("32 كجم");

    await page.getByRole("button", { name: "التالي: القاعة تسجّل المناسبة وتتوقع الفائض" }).click();
    await expect(page.getByText("1 من 6 خطوات مكتملة")).toBeVisible();
    await expect(page.getByText(/E-109 متاحة للتنسيق/)).toBeVisible();
    expect((await stored(page)).events.find((e: { id: string }) => e.id === "E-109").status).toBe("available");

    await page.getByRole("button", { name: "تشغيل الرحلة كاملة" }).click();
    await expect(page.getByText("6 من 6 خطوات مكتملة")).toBeVisible();
    await expect(metric(page, "مناسبات مسجلة")).toContainText("9");
    await expect(metric(page, "مستلم فعليًا من القاعات")).toContainText("52 كجم");
    await expect(metric(page, "نقاط المستفيد")).toContainText("45");
    await expect(page.getByText("سجل نشاط هذه الرحلة — من نفّذ ماذا ومتى")).toBeVisible();

    const data = await stored(page);
    expect(data.events.find((e: { id: string }) => e.id === "E-109").status).toBe("collected");
    expect(data.requests.find((r: { id: string }) => r.id === "R-14").status).toBe("completed");
    expect(data.pledges).toHaveLength(1);
    await expectNoHorizontalScroll(page);

    // The same record is open in the full role screen.
    await page.getByRole("button", { name: "افتح في واجهة مسؤول القاعة" }).click();
    await expect(page).toHaveURL(/\/ar\/hall\/events\/E-109$/);
    await expect(page.getByRole("main").getByText("تم الاستلام").first()).toBeVisible();
  });

  test("judges view is read-only; reset needs confirmation and restores the seed", async ({ page }) => {
    await page.goto("/en/journey");
    await page.getByRole("button", { name: "Play the whole journey" }).click();
    await expect(page.getByText("6 of 6 steps complete")).toBeVisible();

    await page.getByRole("button", { name: "Judges view — read-only" }).click();
    await expect(page.getByText(/Judges view is read-only/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Play|Reset demo|Next:/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Platform manager" }).click();
    await page.getByRole("button", { name: "Reset demo" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Reset the demo data?" });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    expect((await stored(page)).events.some((e: { id: string }) => e.id === "E-109")).toBe(true);

    await page.getByRole("button", { name: "Reset demo" }).click();
    await dialog.getByRole("button", { name: "Yes, reset" }).click();
    await expect(page.getByText("0 of 6 steps complete")).toBeVisible();
    expect((await stored(page)).events.some((e: { id: string }) => e.id === "E-109")).toBe(false);
  });
});
