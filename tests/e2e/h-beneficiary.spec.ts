import type { Page } from "@playwright/test";
import { KEYS, chooseAccount, expect, expectNoHorizontalScroll, test } from "./fixtures";

const stored = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), KEYS.data);
type Req = { id: string; status: string; beneficiaryId: string; listingId: string; units: number };

/** D accepts R-07 (#17's pending request on L-09) through the real D6 screen, then switches back to H. */
async function charityAcceptsR07(page: Page) {
  await chooseAccount(page, "en", "demo-charity-01");
  await page.goto("/en/charity/listings/L-09");
  await page.getByRole("button", { name: "Accept request R-07" }).click();
  await expect(page.getByText("Request R-07 accepted")).toBeVisible();
  await chooseAccount(page, "en", "demo-beneficiary-01");
}

test.describe("H — beneficiary", () => {
  test("H1 lists published listings with availability; sold-out can't be requested; filters work", async ({ page }) => {
    await chooseAccount(page, "ar", "demo-beneficiary-01");
    await expect(page).toHaveURL(/\/ar\/beneficiary$/);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1, name: "الطعام المتاح" })).toBeVisible();
    for (const id of ["L-09", "L-08", "L-07"]) await expect(main.getByText(id).first()).toBeVisible();
    const l07 = main.locator("article").filter({ hasText: "L-07" });
    await expect(l07.getByRole("button", { name: "غير متاح للطلب" })).toBeDisabled();
    await expect(l07.getByText("نفدت الكمية (0 من 4 عبوات)")).toBeVisible();
    await expect(main.locator("article").filter({ hasText: "L-09" }).getByText("متبقٍ 6 من 10 عبوات")).toBeVisible();

    await main.getByRole("button", { name: "مخبوزات" }).click();
    await expect(main.locator("article")).toHaveCount(1);
    await expect(main.locator("article")).toContainText("L-08");
    await expectNoHorizontalScroll(page);
  });

  test("H2 blocks a duplicate open request and shows the over-quantity error", async ({ page }) => {
    await chooseAccount(page, "en", "demo-beneficiary-01");
    // #17 already has R-07 pending on L-09 → no second request on the same listing.
    await page.goto("/en/beneficiary/food/L-09");
    await expect(page.getByText("You already have an open request R-07 on this listing")).toBeVisible();
    await expect(page.locator("#req-qty")).toHaveCount(0);

    // After D accepts and H confirms R-07, the form is available again.
    await charityAcceptsR07(page);
    await page.goto("/en/beneficiary/requests/R-07/confirm");
    await page.getByRole("radio", { name: /I received the full request/ }).check();
    await page.getByRole("main").getByRole("button", { name: "Confirm pickup" }).click();
    await expect(page).toHaveURL(/\/en\/beneficiary\/requests$/);

    await page.goto("/en/beneficiary/food/L-09");
    await page.locator("#req-qty").fill("8");
    await expect(page.locator("#req-qty-error")).toContainText("You can't request 8 — 4 boxes available");
    await expect(page.getByRole("button", { name: "Send request" })).toBeDisabled();
    await page.getByRole("button", { name: "3 boxes" }).click();
    await expect(page.locator("#req-qty")).toHaveValue("3");
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page).toHaveURL(/\/en\/beneficiary\/requests$/);
    await expect(page.getByText("Request R-14 sent")).toBeVisible();
    const r14 = (await stored(page)).requests.find((r: Req) => r.id === "R-14");
    expect(r14).toMatchObject({ listingId: "L-09", units: 3, status: "pending", beneficiaryId: "demo-beneficiary-01" });
    // Pending requests don't hold units: L-09 still shows 4 left.
    await page.goto("/en/beneficiary");
    await expect(page.getByRole("main").locator("article").filter({ hasText: "L-09" })).toContainText(
      "4 of 10 boxes left",
    );
  });

  test("H3 shows only own requests with status lines and filters", async ({ page }) => {
    await chooseAccount(page, "en", "demo-beneficiary-01");
    await page.goto("/en/beneficiary/requests");
    const main = page.getByRole("main");
    for (const id of ["R-07", "R-08", "R-03", "R-04"]) await expect(main.getByText(id)).toBeVisible();
    // Other beneficiaries' requests on the same listings are never shown.
    for (const id of ["R-09", "R-05", "R-11", "R-12", "R-13"]) await expect(main.getByText(id)).toHaveCount(0);
    await expect(main.getByText("Confirmed pickup 20 Oct 2026 · +10 points counted once")).toBeVisible();
    await expect(main.getByText("Reason: Sold out · 0 points")).toBeVisible();
    await main.getByRole("button", { name: "Closed (2)" }).click();
    await expect(main.locator("article")).toHaveCount(2);
    // Pending requests can't be confirmed yet.
    await expect(main.getByRole("link", { name: /Confirm pickup of request/ })).toHaveCount(0);
    await page.goto("/en/beneficiary/requests/R-07/confirm");
    await expect(page.getByRole("heading", { name: "This request can't be confirmed" })).toBeVisible();
  });

  test("H7 accepted request → partial validation → full pickup earns +10 once; shield 35 → 45", async ({ page }) => {
    await charityAcceptsR07(page);
    await page.goto("/en/beneficiary/requests");
    const r07 = page.getByRole("main").locator("article").filter({ hasText: "R-07" });
    await expect(r07).toContainText("Ready for pickup");
    await r07.getByRole("link", { name: "Confirm pickup of request R-07" }).click();

    await page.getByRole("main").getByRole("button", { name: "Confirm pickup" }).click();
    await expect(page.locator("#confirm-kind-error")).toHaveText("Choose what happened at pickup");
    await page.getByRole("radio", { name: /Partial pickup/ }).check();
    await page.locator("#confirm-received").fill("2");
    await page.getByRole("main").getByRole("button", { name: "Confirm pickup" }).click();
    await expect(page.locator("#confirm-received-error")).toHaveText("Enter a number from 1 to 1");
    expect((await stored(page)).requests.find((r: Req) => r.id === "R-07").status).toBe("ready");

    await page.getByRole("radio", { name: /I received the full request/ }).check();
    await page.getByRole("button", { name: "Excellent" }).click();
    await page.getByRole("main").getByRole("button", { name: "Confirm pickup" }).click();
    await expect(page).toHaveURL(/\/en\/beneficiary\/requests$/);
    await expect(page.getByText("Pickup of R-07 confirmed")).toBeVisible();

    const data = await stored(page);
    expect(data.requests.find((r: Req) => r.id === "R-07").status).toBe("completed");
    const pts = data.points.filter((p: { sourceId: string }) => p.sourceId === "R-07");
    expect(pts).toHaveLength(1);

    // Revisiting the confirm page doesn't award again.
    await page.goto("/en/beneficiary/requests/R-07/confirm");
    await expect(page.getByRole("heading", { name: "Confirmation recorded for R-07" })).toBeVisible();

    await page.goto("/en/beneficiary/shield");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Bronze shield · Level 1" })).toBeVisible();
    await expect(main.getByText("5 to Silver (50) · Gold at 150")).toBeVisible();
    await expect(main.getByText("Balance = 10 + 10 + 25")).toBeVisible();
    await expect(main.getByText("5 confirmed pickups (2/5)")).toBeVisible();

    // The charity sees the confirmation and the distributed quantity.
    await chooseAccount(page, "en", "demo-charity-01");
    await page.goto("/en/charity/listings/L-09");
    await expect(page.getByText(/so far 8 kg/)).toBeVisible();
  });

  test("H4 report: validation, then sent for review; it appears in H8 and at the charity, never as food", async ({
    page,
  }) => {
    await chooseAccount(page, "ar", "demo-beneficiary-01");
    // Sidebar on laptop, bottom tab on mobile — whichever is visible.
    await page
      .getByRole("link", { name: /^(أبلغ عن فائض|الإبلاغ عن فائض)$/ })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/ar\/beneficiary\/report$/);
    await page.getByRole("button", { name: "إرسال البلاغ للمراجعة" }).click();
    await expect(page.getByText("لم يُرسل البلاغ — أكمل الحقول المطلوبة.")).toBeVisible();
    await expect(page.locator("#rp-food-error")).toHaveText("اختر نوع الطعام");
    const before = (await stored(page)).reports.length;

    await page.locator("#rp-food").selectOption("cooked");
    await page.locator("#rp-qty").fill("٧");
    await page.locator("#rp-time").selectOption("18:00");
    await page.locator("#rp-area").selectOption({ index: 1 });
    await page.locator("#rp-notes").fill("محفوظ في الثلاجة");
    await page.getByRole("button", { name: "إرسال البلاغ للمراجعة" }).click();
    await expect(page).toHaveURL(/\/ar\/beneficiary\/reports$/);
    await expect(page.getByText("أُرسل البلاغ B-05 للمراجعة")).toBeVisible();
    const b05 = page.getByRole("main").locator("article").filter({ hasText: "B-05" });
    await expect(b05).toContainText("وجبات مطبوخة · 7 كجم (تقدير)");
    await expect(b05).toContainText("قيد المراجعة");

    const data = await stored(page);
    expect(data.reports).toHaveLength(before + 1);
    expect(data.reports.find((r: { id: string }) => r.id === "B-05")).toMatchObject({
      status: "pending",
      estimatedQuantity: 7,
      charityId: "charity-ataa",
      photoAttached: false,
    });
    // Not published as available food, and no points for sending.
    expect(data.listings.some((l: { sourceHandoverId: string | null }) => l.sourceHandoverId === null)).toBe(false);
    expect(data.points.some((p: { sourceId: string }) => p.sourceId === "B-05")).toBe(false);

    await chooseAccount(page, "ar", "demo-charity-01");
    await page.goto("/ar/charity/reports");
    await expect(page.getByRole("main").getByText("B-05").first()).toBeVisible();
  });

  test("H8 needs-info → answer goes back to review and notifies the charity", async ({ page }) => {
    await chooseAccount(page, "en", "demo-beneficiary-01");
    await page.goto("/en/beneficiary/reports");
    const b03 = page.getByRole("main").locator("article").filter({ hasText: "B-03" });
    await expect(b03).toContainText("Needs info");
    await b03.getByRole("button", { name: "Add information" }).click();
    await b03.getByRole("button", { name: "Send information" }).click();
    await expect(b03.getByText("Write your answer before sending")).toBeVisible();
    await b03.getByRole("textbox").fill("Yes, covered and in the fridge since 14:00.");
    await b03.getByRole("button", { name: "Send information" }).click();
    await expect(b03).toContainText("Under review");
    await expect(b03).toContainText("You added the requested information");
    const data = await stored(page);
    const b = data.reports.find((r: { id: string }) => r.id === "B-03");
    expect(b.status).toBe("pending");
    expect(b.infoRequest.answer).toContain("covered");
    expect(
      data.notices.some(
        (n: { recipientUserId: string; kind: string }) =>
          n.recipientUserId === "demo-charity-01" && n.kind === "report_info_added",
      ),
    ).toBe(true);
  });

  test("H6 pledge is recorded once and earns no points", async ({ page }) => {
    await chooseAccount(page, "en", "demo-beneficiary-01");
    await page.getByRole("main").getByRole("link", { name: "Read the tip" }).click();
    await expect(page).toHaveURL(/\/en\/beneficiary\/tip$/);
    const pointsBefore = (await stored(page)).points.length;
    await page.getByRole("button", { name: "I'll try it this week" }).click();
    await expect(page.getByRole("button", { name: "Pledge recorded" })).toBeDisabled();
    const data = await stored(page);
    expect(data.pledges).toHaveLength(1);
    expect(data.points).toHaveLength(pointsBefore);
  });

  test("bottom tabs on mobile use the Figma labels", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "bottom tabs exist below 1024px only");
    await chooseAccount(page, "ar", "demo-beneficiary-01");
    const tabs = page.getByRole("navigation", { name: "التنقل الرئيسي" }).last();
    for (const label of ["الرئيسية", "طلباتي", "أبلغ عن فائض", "درعي"])
      await expect(tabs.getByRole("link", { name: label })).toBeVisible();
    await tabs.getByRole("link", { name: "درعي" }).click();
    await expect(page).toHaveURL(/\/ar\/beneficiary\/shield$/);
    await expect(tabs.getByRole("link", { name: "درعي" })).toHaveAttribute("aria-current", "page");
    await expectNoHorizontalScroll(page);
  });
});
