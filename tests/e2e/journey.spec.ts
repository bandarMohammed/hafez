import type { Page } from "@playwright/test";
import { KEYS, chooseAccount, expect, test } from "./fixtures";

const stored = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), KEYS.data);
const statusOf = async (page: Page, id: string) =>
  (await stored(page)).events.find((e: { id: string }) => e.id === id).status;

/**
 * One record travels through every built role, using only the UI:
 * C2/C3 hall → D2/D4 charity → E2–E4 field → D5 charity → C hall → D6 listing → H2 request → D6 accept → H7 confirm.
 */
test("full journey: a new event becomes food a beneficiary confirms, with points and impact", async ({ page }) => {
  test.setTimeout(120_000);

  // C2 + C3 — the hall registers E-109 and makes it available.
  await chooseAccount(page, "en", "demo-hall-01");
  await page.goto("/en/hall/events/new");
  await page.locator("#ne-title").fill("Journey wedding");
  await page.locator("#ne-date").selectOption({ index: 10 });
  await page.locator("#ne-guests").fill("300");
  await page.locator("#ne-endTime").selectOption("23:00");
  await page.locator("#ne-readyTime").selectOption("23:30");
  await page.locator("#ne-foodTypes").click();
  await page.getByRole("checkbox", { name: "Hot meals" }).check();
  await page.keyboard.press("Escape");
  await page.locator("#ne-plannedKg").fill("210");
  await page.locator("#ne-contactPhone").fill("0500000000");
  await page.getByRole("button", { name: "Save & make available" }).click();
  await expect(page).toHaveURL(/\/en\/hall\/events\/E-109\/forecast$/);
  await page.getByRole("button", { name: "Use 180 kg & make available" }).click();
  await expect(page).toHaveURL(/\/en\/hall$/);
  expect(await statusOf(page, "E-109")).toBe("available");

  // D2 → D4 — the charity sees it, expresses interest and assigns representative 01.
  await chooseAccount(page, "en", "demo-charity-01");
  await page.goto("/en/charity/opportunities");
  await page.getByRole("main").getByRole("link", { name: /E-109/ }).first().click();
  await page.getByRole("button", { name: "Express interest in pickup" }).click();
  await expect(page).toHaveURL(/\/en\/charity\/opportunities\/E-109\/assign$/);
  await page.getByRole("radio", { name: /Representative 01/ }).check();
  await page.getByRole("button", { name: "Confirm assignment" }).click();
  await expect(page.getByText("A rep was assigned to E-109")).toBeVisible();
  expect(await statusOf(page, "E-109")).toBe("assigned");

  // E1 → E4 — the representative checks in, inspects and records a provisional handover.
  await chooseAccount(page, "en", "demo-field-01");
  await page.getByRole("main").getByRole("link", { name: /E-109/ }).first().click();
  await page.getByRole("button", { name: "Check in now" }).click();
  await page.getByRole("link", { name: "Continue the inspection" }).click();
  await page.getByRole("radio", { name: /Surplus available to collect/ }).check();
  await page.locator("#insp-qty").fill("40");
  await page.locator("#insp-food").selectOption("good");
  await page.locator("#insp-pack").selectOption("sealed_clean");
  await page.getByRole("button", { name: "Save inspection & continue" }).click();
  await expect(page).toHaveURL(/\/en\/field\/tasks\/E-109\/handover$/);
  await page.locator("#ho-qty").fill("36");
  await page.locator("#ho-food").fill("Rice and meat");
  await page.locator("#ho-by").fill("Hall manager (demo)");
  await page.getByRole("button", { name: "Record provisional handover" }).click();
  await expect(page).toHaveURL(/\/en\/field\/tasks\/E-109$/);
  expect(await statusOf(page, "E-109")).toBe("inspected");

  // D5 — the charity confirms receipt → Collected.
  await chooseAccount(page, "en", "demo-charity-01");
  await page.goto("/en/charity/handovers");
  await page.getByRole("main").getByRole("link", { name: /E-109/ }).click();
  await page.getByRole("button", { name: "Confirm charity receipt" }).click();
  await expect(page.getByText("E-109 receipt confirmed")).toBeVisible();
  expect(await statusOf(page, "E-109")).toBe("collected");

  // C — the hall sees the same record as collected with the documented quantity.
  await chooseAccount(page, "en", "demo-hall-01");
  await page.goto("/en/hall/events/E-109");
  await expect(page.getByRole("main").getByText("Collected").first()).toBeVisible();
  await expect(page.getByRole("main").getByText("36 kg").first()).toBeVisible();

  // D6 — the charity packages part of the documented 36 kg into a listing (10 × 2 kg).
  await chooseAccount(page, "en", "demo-charity-01");
  await page.goto("/en/charity/listings/new");
  await page.locator("#pl-title").fill("Rice & meat — journey boxes");
  await page.locator("#pl-total").fill("10");
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page).toHaveURL(/\/en\/charity\/listings$/);
  const listing = (await stored(page)).listings.find(
    (l: { title: { en: string } }) => l.title.en === "Rice & meat — journey boxes",
  );
  expect(listing.id).toBe("L-10");

  // H2 — the beneficiary requests 3 boxes.
  await chooseAccount(page, "en", "demo-beneficiary-01");
  await page.getByRole("main").getByRole("link", { name: "View details of listing L-10 and request" }).click();
  await page.locator("#req-qty").fill("3");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Request R-14 sent")).toBeVisible();

  // D6 — the charity accepts; the remaining quantity drops.
  await chooseAccount(page, "en", "demo-charity-01");
  await page.goto("/en/charity/listings/L-10");
  await page.getByRole("button", { name: "Accept request R-14" }).click();
  await expect(page.getByText("Request R-14 accepted")).toBeVisible();

  // H7 — the beneficiary confirms the full pickup → +10 once, impact counts 6 kg distributed.
  await chooseAccount(page, "en", "demo-beneficiary-01");
  await page.goto("/en/beneficiary/requests");
  await page.getByRole("link", { name: "Confirm pickup of request R-14" }).click();
  await page.getByRole("radio", { name: /I received the full request/ }).check();
  await page.getByRole("main").getByRole("button", { name: "Confirm pickup" }).click();
  await expect(page.getByText("Pickup of R-14 confirmed")).toBeVisible();

  const data = await stored(page);
  expect(data.requests.find((r: { id: string }) => r.id === "R-14").status).toBe("completed");
  expect(data.points.filter((p: { sourceId: string }) => p.sourceId === "R-14")).toHaveLength(1);
  await page.goto("/en/beneficiary/shield");
  await expect(page.getByRole("main").getByText("Balance = 10 + 10 + 25")).toBeVisible();

  await chooseAccount(page, "en", "demo-charity-01");
  await page.goto("/en/charity/listings/L-10");
  await expect(page.getByText(/so far 6 kg/)).toBeVisible();
  const after = await stored(page);
  const held = after.requests
    .filter((r: { listingId: string; status: string }) => r.listingId === "L-10" && r.status === "completed")
    .reduce((n: number, r: { units: number }) => n + r.units, 0);
  expect(10 - held).toBe(7);
});
