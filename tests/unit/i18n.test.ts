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

/** Top-level `{…}` groups of an ICU string (handles nesting). */
function groups(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (text[i] === "}") {
      depth--;
      if (depth === 0) out.push(text.slice(start, i));
    }
  }
  return out;
}

/** ICU argument names: "{name}" and "{name, plural, …}", including arguments nested inside plural branches. */
function placeholders(text: string): string[] {
  const names: string[] = [];
  for (const g of groups(text)) {
    const simple = /^\s*(\w+)\s*$/.exec(g);
    const complex = /^\s*(\w+)\s*,\s*(plural|select|selectordinal)\s*,([\s\S]*)$/.exec(g);
    if (simple) names.push(simple[1]!);
    else if (complex) {
      names.push(complex[1]!);
      for (const branch of groups(complex[3]!)) names.push(...placeholders(branch));
    }
  }
  return [...new Set(names)].sort();
}

function lookup(tree: Tree, path: string): string {
  return path.split(".").reduce<string | Tree>((node, k) => (node as Tree)[k]!, tree) as string;
}

describe("message catalogs", () => {
  it("Arabic and English have exactly the same keys", () => {
    expect(keys(ar as unknown as Tree).sort()).toEqual(keys(en as unknown as Tree).sort());
  });

  it("no key contains a dot (next-intl uses dots for nesting)", () => {
    const leafNames = (t: Tree): string[] =>
      Object.entries(t).flatMap(([k, v]) => [k, ...(typeof v === "string" ? [] : leafNames(v))]);
    expect(leafNames(ar as unknown as Tree).filter((k) => k.includes("."))).toEqual([]);
  });

  it("placeholders match between languages", () => {
    for (const k of keys(ar as unknown as Tree)) {
      expect(placeholders(lookup(en as unknown as Tree, k)), k).toEqual(placeholders(lookup(ar as unknown as Tree, k)));
    }
  });

  it("no empty strings", () => {
    for (const k of keys(ar as unknown as Tree)) {
      expect(lookup(ar as unknown as Tree, k).trim(), `ar ${k}`).not.toBe("");
      expect(lookup(en as unknown as Tree, k).trim(), `en ${k}`).not.toBe("");
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
