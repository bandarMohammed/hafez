import type { Page } from "@playwright/test";
import { KEYS, chooseAccount, expect, expectNoHorizontalScroll, test } from "./fixtures";

const stored = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), KEYS.data);
const statusOf = async (page: Page, id: string) =>
  (await stored(page)).events.find((e: { id: string }) => e.id === id).status;

test.describe("E — field representative", () => {
  test("E1 shows only tasks assigned to this representative", async ({ page }) => {
    await chooseAccount(page, "ar", "demo-field-01");
    await expect(page).toHaveURL(/\/ar\/field$/);
    const main = page.getByRole("main");
    for (const id of ["E-108", "E-105", "E-101", "E-102", "E-103", "B-01"])
      await expect(main.getByText(id).first()).toBeVisible();
    // Other events and another rep's report inspection (B-02 → rep 02) are not visible.
    for (const id of ["E-104", "E-106", "E-107", "B-02"]) await expect(main.getByText(id)).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });

  test("a task that isn't assigned to you can't be opened", async ({ page }) => {
    await chooseAccount(page, "en", "demo-field-01");
    await page.goto("/en/field/tasks/E-104");
    await expect(page.getByRole("heading", { name: "This task isn't assigned to you" })).toBeVisible();
    await page.goto("/en/field/tasks/E-105/inspect"); // assigned, but not checked in yet
    await expect(page.getByRole("heading", { name: "This task isn't assigned to you" })).toBeVisible();
  });

  test("E2 check-in → E3 'no surplus' needs a reason → E5, no received weight", async ({ page }) => {
    await chooseAccount(page, "en", "demo-field-01");
    await page.goto("/en/field/tasks/E-105");
    await page.getByRole("button", { name: "Check in now" }).click();
    await expect(page.getByText("Check-in at E-105 recorded")).toBeVisible();
    expect(await statusOf(page, "E-105")).toBe("representative_arrived");

    await page.getByRole("link", { name: "Continue the inspection" }).click();
    await page.getByRole("radio", { name: /No collectable surplus/ }).check();
    await page.getByRole("button", { name: "Save result & close task" }).click();
    await expect(page.locator("#insp-reason-error")).toHaveText("Choose the reason");
    expect(await statusOf(page, "E-105")).toBe("representative_arrived");

    await page.locator("#insp-reason").selectOption("finished_during_event");
    await page.getByRole("button", { name: "Save result & close task" }).click();
    await expect(page).toHaveURL(/\/en\/field\/tasks\/E-105\/result$/);
    await expect(page.getByRole("heading", { name: "Visit recorded: no surplus" })).toBeVisible();
    await expect(page.getByText("Not recorded", { exact: true })).toBeVisible();
    const data = await stored(page);
    expect(data.events.find((e: { id: string }) => e.id === "E-105").status).toBe("no_surplus");
    expect(data.handovers.some((h: { eventId: string }) => h.eventId === "E-105")).toBe(false);
  });

  test("E3 → E4 validation → provisional handover → D5 charity confirmation completes Collected", async ({ page }) => {
    await chooseAccount(page, "en", "demo-field-01");
    await page.goto("/en/field/tasks/E-108/inspect");
    await page.getByRole("radio", { name: /Surplus available to collect/ }).check();
    await page.getByRole("button", { name: "Save inspection & continue" }).click();
    await expect(page.getByText("The result wasn't saved")).toBeVisible();
    await page.locator("#insp-qty").fill("30");
    await page.locator("#insp-food").selectOption("good");
    await page.locator("#insp-pack").selectOption("sealed_clean");
    await page.getByRole("checkbox", { name: "Containers sealed and clean" }).check();
    await page.getByRole("button", { name: "Save inspection & continue" }).click();
    await expect(page).toHaveURL(/\/en\/field\/tasks\/E-108\/handover$/);

    // Figma E4: no actual quantity → "Collected" can't be confirmed; nothing changes.
    await page.getByRole("button", { name: "Record provisional handover" }).click();
    await expect(page.getByText("“Collected” can't be confirmed")).toBeVisible();
    await expect(page.getByText("The actual quantity is required. The status didn't change.")).toBeVisible();
    expect((await stored(page)).handovers.some((h: { eventId: string }) => h.eventId === "E-108")).toBe(false);

    await page.locator("#ho-qty").fill("28");
    await page.locator("#ho-food").fill("Pastries, juices");
    await page.locator("#ho-by").fill("Hall manager (demo)");
    await page.getByRole("button", { name: "Record provisional handover" }).click();
    await expect(page).toHaveURL(/\/en\/field\/tasks\/E-108$/);
    await expect(page.getByText("Provisional handover recorded for E-108")).toBeVisible();
    await expect(page.getByText("waiting for the charity coordinator to confirm")).toBeVisible();
    expect(await statusOf(page, "E-108")).toBe("inspected");

    // D5 — the charity sees it pending and confirms.
    await chooseAccount(page, "en", "demo-charity-01");
    await page.goto("/en/charity/handovers");
    await page.getByRole("main").getByRole("link", { name: /E-108/ }).click();
    await page.getByRole("button", { name: "Confirm charity receipt" }).click();
    await expect(page.getByText("E-108 receipt confirmed")).toBeVisible();
    expect(await statusOf(page, "E-108")).toBe("collected");

    // Back to the representative: completed task + notice.
    await chooseAccount(page, "en", "demo-field-01");
    await page.goto("/en/field/tasks/E-108");
    await expect(page.getByText("“Collected” complete — 28 kg actual.")).toBeVisible();
    await page.goto("/en/field/notices");
    await expect(page.getByText("E-108 receipt confirmed").first()).toBeVisible();
  });

  test("report inspection → charity documents rescue → reporter earns points once", async ({ page }) => {
    await chooseAccount(page, "en", "demo-charity-01");
    await page.goto("/en/charity/reports/B-04");
    await page.getByRole("button", { name: "Accept & assign inspection" }).click();
    await page.locator("#rp-rep").selectOption("demo-field-01");
    await page.getByRole("button", { name: "Confirm acceptance & assignment" }).click();
    await expect(page.getByText("Report B-04 accepted and inspection assigned")).toBeVisible();

    await chooseAccount(page, "en", "demo-field-01");
    await page.getByRole("main").getByRole("link", { name: /B-04/ }).click();
    await page.getByRole("radio", { name: /^Rescued/ }).check();
    await page.getByRole("button", { name: "Record result" }).click();
    await expect(page.getByText("Enter the actual quantity")).toBeVisible();
    await page.locator("#rpi-kg").fill("5");
    await page.getByRole("button", { name: "Record result" }).click();
    await expect(page).toHaveURL(/\/en\/field$/);
    expect((await stored(page)).points.some((p: { sourceId: string }) => p.sourceId === "B-04")).toBe(false);

    await chooseAccount(page, "en", "demo-charity-01");
    await page.goto("/en/charity/reports/B-04");
    await page.getByRole("button", { name: "Document rescue of 5 kg" }).click();
    await expect(page.getByText("Rescue of B-04 documented")).toBeVisible();
    const data = await stored(page);
    expect(data.points.filter((p: { sourceId: string }) => p.sourceId === "B-04")).toHaveLength(1);
    expect(data.reports.find((r: { id: string }) => r.id === "B-04").status).toBe("coordinated");
  });

  test("E6 notices: mark all as read clears the bell count", async ({ page }) => {
    await chooseAccount(page, "en", "demo-field-01");
    await page.goto("/en/field/notices");
    await expect(page.getByRole("button", { name: "Unread (2)" })).toBeVisible();
    await page.getByRole("button", { name: "Mark all as read" }).click();
    await expect(page.getByRole("button", { name: "Unread (0)" })).toBeVisible();
  });

  test("E7 profile lists what this role can and can't do", async ({ page }) => {
    await chooseAccount(page, "en", "demo-field-01");
    await page.goto("/en/field/profile");
    await expect(page.getByRole("main").getByText("Representative 01 — Al Ataa team")).toBeVisible();
    await expect(page.getByText("See all events or assign tasks to yourself")).toBeVisible();
  });
});
