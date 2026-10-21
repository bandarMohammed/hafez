import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export const KEYS = { data: "hafez.demo.data.v1", session: "hafez.demo.session.v1" } as const;

/**
 * Every test fails if the page logs a console error or throws an uncaught exception.
 * (Next.js 404 navigations log a network 404 for the document itself; those are expected and ignored.)
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        if (/Failed to load resource: the server responded with a status of 404/.test(msg.text())) return;
        errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(err.message));
      await use(errors);
      expect(errors, "console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Fails if the document is wider than the viewport (horizontal scroll). */
export async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, "horizontal overflow").toBeLessThanOrEqual(clientWidth);
}

/** Selects a demo account through the real A2 UI. */
export async function chooseAccount(page: Page, locale: "ar" | "en", accountId: string) {
  await page.goto(`/${locale}`);
  await page.locator(`[data-account="${accountId}"]`).click();
}
