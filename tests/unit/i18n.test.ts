import { describe, expect, it } from "vitest";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
import { formatDate, formatNumber, formatTime } from "@/lib/format";

type Tree = { [k: string]: string | Tree };

function keys(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === "string" ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );
}

function placeholders(text: string): string[] {
  // ICU arguments only: "{name}" or "{name, plural, …}" — not words inside plural branches.
  return [...text.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1]!).sort();
}

function lookup(tree: Tree, path: string): string {
  return path.split(".").reduce<string | Tree>((node, k) => (node as Tree)[k]!, tree) as string;
}

describe("message catalogs", () => {
  it("Arabic and English have exactly the same keys", () => {
    expect(keys(ar as Tree).sort()).toEqual(keys(en as Tree).sort());
  });

  it("no key contains a dot (next-intl uses dots for nesting)", () => {
    const leafNames = (t: Tree): string[] =>
      Object.entries(t).flatMap(([k, v]) => [k, ...(typeof v === "string" ? [] : leafNames(v))]);
    expect(leafNames(ar as Tree).filter((k) => k.includes("."))).toEqual([]);
  });

  it("placeholders match between languages", () => {
    for (const k of keys(ar as Tree)) {
      expect(placeholders(lookup(en as Tree, k)), k).toEqual(placeholders(lookup(ar as Tree, k)));
    }
  });

  it("no empty strings", () => {
    for (const k of keys(ar as Tree)) {
      expect(lookup(ar as Tree, k).trim(), `ar ${k}`).not.toBe("");
      expect(lookup(en as Tree, k).trim(), `en ${k}`).not.toBe("");
    }
  });
});

describe("formatting (brand: Latin digits, Gregorian, Riyadh time)", () => {
  const iso = "2026-10-23T20:30:00.000Z"; // 23:30 in Riyadh

  it("Arabic dates use Latin digits and the Gregorian calendar", () => {
    const text = formatDate(iso, "ar");
    expect(text).toMatch(/23/);
    expect(text).toMatch(/2026/);
    expect(text).toContain("أكتوبر");
    expect(text).not.toMatch(/[٠-٩]/);
  });

  it("times are 24h in Asia/Riyadh", () => {
    expect(formatTime(iso, "ar")).toBe("23:30");
    expect(formatTime(iso, "en")).toBe("23:30");
  });

  it("numbers use Latin digits in both languages", () => {
    expect(formatNumber(1234.5, "ar")).not.toMatch(/[٠-٩]/);
    expect(formatNumber(40, "en")).toBe("40");
  });
});
