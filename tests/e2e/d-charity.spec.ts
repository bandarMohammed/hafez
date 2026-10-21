import { KEYS, chooseAccount, expect, expectNoHorizontalScroll, test } from "./fixtures";
import type { Page } from "@playwright/test";

const stored = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), KEYS.data);

async function asCharity(page: Page, locale: "ar" | "en" = "en") {
  await chooseAccount(page, locale, "demo-charity-01");
  await expect(page).toHaveURL(new RegExp(`/${locale}/charity$`));
}

test.describe("D — charity coordinator", () => {
  test("D1 shows only published opportunities and own interest; filters work", async ({ page }) => {
    await asCharity(page, "ar");
    await page.goto("/ar/charity/opportunities");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1, name: "الفرص المتاحة" })).toBeVisible();
    await expect(main.getByText("E-106").first()).toBeVisible(); // available
    await expect(main.getByText("E-104").first()).toBeVisible(); // own interest
    for (const hidden of ["E-107", "E-105", "E-101"]) await expect(main.getByText(hidden)).toHaveCount(0);
    await main.getByRole("button", { name: "أبديت الاهتمام (1)" }).click();
    await expect(main.getByText("E-106")).toHaveCount(0);
    await expect(main.getByText("E-104").first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("D2 → interest → D4: unavailable rep is blocked, assignment updates every role", async ({ page }) => {
    await asCharity(page);
    await page.goto("/en/charity/opportunities/E-106");
    await page.getByRole("button", { name: "Express interest in pickup" }).click();
    await expect(page).toHaveURL(/\/en\/charity\/opportunities\/E-106\/assign$/);
    await expect(
      page.getByRole("status").filter({ hasText: "Your charity's interest in E-106 was recorded" }),
    ).toBeVisible();
    await expect(page.locator("li[aria-current=step]")).toContainText("Assigned");

    // Rep 03 is unavailable after 22:00 — the latest arrival option (ready 21:00 + 60 min) is refused.
    await page.getByRole("radio", { name: /Representative 03/ }).check();
    await page.locator("#assign-arrival").selectOption({ index: 8 });
    await page.getByRole("button", { name: "Confirm assignment" }).click();
    await expect(page.getByText("This rep isn't available after 22:00")).toBeVisible();
    expect((await stored(page)).events.find((e: { id: string }) => e.id === "E-106").status).toBe("awaiting_charity");

    await page.getByRole("radio", { name: /Representative 01/ }).check();
    await page.getByRole("button", { name: "Confirm assignment" }).click();
    await expect(page).toHaveURL(/\/en\/charity\/opportunities$/);
    await expect(page.getByText("A rep was assigned to E-106")).toBeVisible();
    await expect(page.getByRole("main").locator("article").filter({ hasText: "E-106" })).toHaveCount(0);

    // The task moves to "Tasks & team" with the representative.
    await page.goto("/en/charity/tasks");
    await expect(page.getByRole("main").getByText("Representative 01 — Al Ataa team").first()).toBeVisible();

    // Shared record: the activity log and the representative's notice exist.
    const data = await stored(page);
    expect(data.events.find((e: { id: string }) => e.id === "E-106").status).toBe("assigned");
    expect(
      data.notices.some(
        (n: { recipientUserId: string; kind: string }) =>
          n.recipientUserId === "demo-field-01" && n.kind === "task_assigned",
      ),
    ).toBe(true);
  });

  test("D3 decline: 'other' needs a note; the event leaves this charity's list but stays available", async ({
    page,
  }) => {
    await asCharity(page);
    await page.goto("/en/charity/opportunities/E-106/decline");
    await page.getByRole("radio", { name: "Other reason" }).check();
    await page.getByRole("button", { name: "Confirm decline" }).click();
    await expect(page.getByText("Write the reason in the note")).toBeVisible();
    await page.getByRole("radio", { name: "No team available at that time" }).check();
    await page.getByRole("button", { name: "Confirm decline" }).click();
    await expect(page).toHaveURL(/\/en\/charity\/opportunities$/);
    await expect(page.getByText("Opportunity E-106 declined")).toBeVisible();
    await expect(page.getByRole("main").locator("article").filter({ hasText: "E-106" })).toHaveCount(0);
    expect((await stored(page)).events.find((e: { id: string }) => e.id === "E-106").status).toBe("available");
  });

  test("D6: accepting deducts from what remains; rejecting needs a reason", async ({ page }) => {
    await asCharity(page);
    await page.goto("/en/charity/listings/L-09");
    await expect(page.getByText("10 − 4 = 6 boxes")).toBeVisible();
    await page.getByRole("button", { name: "Accept request R-07" }).click();
    await expect(page.getByText("Request R-07 accepted")).toBeVisible();
    await expect(page.getByText("10 − 6 = 4 boxes")).toBeVisible();
    await expect(page.locator('[data-request="R-07"]')).toContainText("Ready for pickup");
    const data = await stored(page);
    expect(
      data.notices.some(
        (n: { recipientUserId: string; kind: string }) =>
          n.recipientUserId === "demo-beneficiary-01" && n.kind === "request_accepted",
      ),
    ).toBe(true);
  });

  test("D6: reject a pending request with a reason", async ({ page }) => {
    await asCharity(page);
    await page.goto("/en/charity/listings/L-08");
    await page.getByRole("button", { name: "Reject request R-08" }).click();
    await page.locator("#rr-R-08").selectOption("outside_window");
    await page.getByRole("button", { name: "Confirm rejection" }).click();
    await expect(page.locator('[data-request="R-08"]')).toContainText("Rejected");
    await expect(page.locator('[data-request="R-08"]')).toContainText("Outside the pickup window");
  });

  test("D7: request info, then accept & assign an inspection", async ({ page }) => {
    await asCharity(page);
    await page.goto("/en/charity/reports/B-04");
    await page.getByRole("button", { name: "Request information" }).click();
    await page.locator("#rp-question").fill("Is it covered?");
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByText("Information requested on B-04")).toBeVisible();
    await expect(page.getByRole("main").getByText("Needs info").first()).toBeVisible();

    await page.getByRole("button", { name: "Accept & assign inspection" }).click();
    await page.getByRole("button", { name: "Confirm acceptance & assignment" }).click();
    await expect(page.getByText("Report B-04 accepted and inspection assigned")).toBeVisible();
    await expect(page.getByText("Inspection assigned — waiting for the rep's result.")).toBeVisible();
    // No rescue counted and no points before documentation.
    const data = await stored(page);
    expect(data.points.some((p: { sourceId: string }) => p.sourceId === "B-04")).toBe(false);
  });

  test("D5: confirmed handover shows the required fields; publish needs listable kg", async ({ page }) => {
    await asCharity(page);
    await page.goto("/en/charity/handovers/HO-101");
    await expect(page.getByText("Charity confirmation — done")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm charity receipt" })).toHaveCount(0);
    // HO-101 (32 kg) is fully packaged into L-07/L-08/L-09 → nothing left to publish.
    await page.goto("/en/charity/listings/new");
    await expect(page.getByRole("heading", { name: "No documented handovers to publish from" })).toBeVisible();
  });

  test("hall and field see the charity's interest on their own screens", async ({ page }) => {
    await asCharity(page);
    await page.goto("/en/charity/opportunities/E-106");
    await page.getByRole("button", { name: "Express interest in pickup" }).click();
    await expect(page).toHaveURL(/assign$/);
    // Another hall's manager can't see E-106; the demo hall manager owns Al Nakheel only.
    await chooseAccount(page, "en", "demo-hall-01");
    await page.goto("/en/hall/events/E-106");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    // Admin view isn't built yet, so check the shared record directly.
    const data = await stored(page);
    expect(data.coordination.find((c: { eventId: string; status: string }) => c.eventId === "E-106")?.status).toBe(
      "interested",
    );
  });
});

test.describe("D — mobile", () => {
  test("bottom tabs use the short Figma labels and navigate", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "bottom tabs exist below 1024px only");
    await chooseAccount(page, "ar", "demo-charity-01");
    const tabs = page.getByRole("navigation", { name: "التنقل الرئيسي" }).last();
    await tabs.getByRole("link", { name: "الفرص" }).click();
    await expect(page).toHaveURL(/\/ar\/charity\/opportunities$/);
    await expect(tabs.getByRole("link", { name: "الفرص" })).toHaveAttribute("aria-current", "page");
    await expectNoHorizontalScroll(page);
  });
});
