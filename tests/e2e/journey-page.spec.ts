import type { Page } from "@playwright/test";
import { KEYS, expect, expectNoHorizontalScroll, test } from "./fixtures";

const stored = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), KEYS.data);
const impact = (page: Page) => page.getByRole("region", { name: /لوحة الأثر|Impact dashboard/ });

test.describe("Hafez journey page (pitch)", () => {
  test("A2 entry → step by step → whole journey → dashboard and records update", async ({ page }) => {
    await page.goto("/ar");
    await page.getByRole("link", { name: "افتح رحلة حفيظ" }).click();
    await expect(page).toHaveURL(/\/ar\/journey$/);
    await expect(page.getByRole("heading", { level: 1, name: "من فائض المناسبة إلى أثر يُقاس" })).toBeVisible();
    await expect(page.getByText("0 من 6 خطوات")).toBeVisible();
    // Platform manager only — no judges view on this page.
    await expect(page.getByRole("button", { name: /عرض الحكّام/ })).toHaveCount(0);

    const hero = impact(page).getByRole("region", { name: "طعام أُنقذ بتوثيق" });
    await expect(hero).toContainText("36");
    await expect(hero).toContainText("لا تغيير منذ بدء العرض");

    await page.getByRole("button", { name: "نفّذ الخطوة التالية: القاعة" }).click();
    await expect(page.getByText("1 من 6 خطوات")).toBeVisible();
    await expect(page.getByRole("heading", { name: "القاعة تسجّل المناسبة وتتوقع الفائض" })).toBeVisible();
    await expect(page.getByText(/E-109 متاحة للتنسيق/)).toBeVisible();
    expect((await stored(page)).events.find((e: { id: string }) => e.id === "E-109").status).toBe("available");

    await page.getByRole("button", { name: "تشغيل الرحلة كاملة" }).click();
    await expect(page.getByText("6 من 6 خطوات")).toBeVisible();
    await expect(hero).toContainText("56");
    await expect(hero).toContainText("20 كجم منذ بدء العرض");
    await expect(impact(page).getByText("30 كجم منذ بدء العرض")).toBeVisible();
    await expect(impact(page).getByText("4 كجم منذ بدء العرض")).toBeVisible();
    await expect(page.getByText("سجل نشاط هذه الرحلة — من نفّذ ماذا ومتى")).toBeVisible();

    // The trend chart has a table view with the same numbers.
    await impact(page).getByText("عرض البيانات كجدول").click();
    await expect(impact(page).getByRole("table")).toContainText("56 كجم");

    const data = await stored(page);
    expect(data.events.find((e: { id: string }) => e.id === "E-109").status).toBe("collected");
    expect(data.requests.find((r: { id: string }) => r.id === "R-14").status).toBe("completed");
    expect(data.pledges).toHaveLength(1);
    await expectNoHorizontalScroll(page);

    // Any step can be reopened from the tracker, and its record opens in the full role screen.
    await page.getByRole("button", { name: /^1\. القاعة تسجّل المناسبة/ }).click();
    await page.getByRole("button", { name: "افتح في واجهة مسؤول القاعة" }).click();
    await expect(page).toHaveURL(/\/ar\/hall\/events\/E-109$/);
    await expect(page.getByRole("main").getByText("تم الاستلام").first()).toBeVisible();
  });

  test("reset needs confirmation and restores the seed", async ({ page }) => {
    await page.goto("/en/journey");
    await page.getByRole("button", { name: "Play the whole journey" }).click();
    await expect(page.getByText("6 of 6 steps")).toBeVisible();

    await page.getByRole("button", { name: "Reset demo" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Reset the demo data?" });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    expect((await stored(page)).events.some((e: { id: string }) => e.id === "E-109")).toBe(true);

    await page.getByRole("button", { name: "Reset demo" }).click();
    await dialog.getByRole("button", { name: "Yes, reset" }).click();
    await expect(page.getByText("0 of 6 steps")).toBeVisible();
    expect((await stored(page)).events.some((e: { id: string }) => e.id === "E-109")).toBe(false);
    await expect(impact(page).getByText("No change since the demo started").first()).toBeVisible();
  });
});
