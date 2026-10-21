import { describe, expect, it } from "vitest";
import { DEMO_CONFIG } from "@/config/demo";
import { createLocalRepository, createMemoryStorage } from "@/data/repository";
import { createSeed } from "@/data/seed";

const { data: DATA_KEY, session: SESSION_KEY } = DEMO_CONFIG.storageKeys;

describe("local demo repository", () => {
  it("seeds empty storage and persists the seed", () => {
    const storage = createMemoryStorage();
    const result = createLocalRepository(storage).load();
    expect(result.ok && result.source).toBe("seed");
    expect(storage.getItem(DATA_KEY)).not.toBeNull();
  });

  it("loads valid stored data", () => {
    const data = createSeed();
    data.events[0]!.expectedGuests = 999;
    const storage = createMemoryStorage({ [DATA_KEY]: JSON.stringify(data) });
    const result = createLocalRepository(storage).load();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("storage");
      expect(result.data.events[0]!.expectedGuests).toBe(999);
    }
  });

  it("reports corrupt JSON instead of crashing", () => {
    const storage = createMemoryStorage({ [DATA_KEY]: "{not json" });
    expect(createLocalRepository(storage).load()).toEqual({ ok: false, reason: "corrupt" });
  });

  it("reports data that fails schema validation", () => {
    const bad = { ...createSeed(), events: [{ id: 1 }] };
    const storage = createMemoryStorage({ [DATA_KEY]: JSON.stringify(bad) });
    expect(createLocalRepository(storage).load()).toEqual({ ok: false, reason: "corrupt" });
  });

  it("reseeds data from another seed version", () => {
    const old = { ...createSeed(), version: DEMO_CONFIG.dataVersion + 1 };
    const storage = createMemoryStorage({ [DATA_KEY]: JSON.stringify(old) });
    const result = createLocalRepository(storage).load();
    expect(result.ok && result.source).toBe("seed");
    expect(result.ok && result.data.version).toBe(DEMO_CONFIG.dataVersion);
  });

  it("reset restores the seed and touches only the app's key", () => {
    const storage = createMemoryStorage({ [DATA_KEY]: "{broken", "other.app": "keep" });
    const repo = createLocalRepository(storage);
    expect(repo.reset()).toEqual(createSeed());
    expect(repo.load().ok).toBe(true);
    expect(storage.getItem("other.app")).toBe("keep");
  });

  it("stores and clears the session user id", () => {
    const storage = createMemoryStorage();
    const repo = createLocalRepository(storage);
    expect(repo.getSessionUserId()).toBeNull();
    repo.setSessionUserId("demo-hall-01");
    expect(storage.getItem(SESSION_KEY)).toBe("demo-hall-01");
    repo.setSessionUserId(null);
    expect(repo.getSessionUserId()).toBeNull();
  });

  it("seed copies are independent (no shared mutation)", () => {
    const a = createSeed();
    a.events[0]!.title.ar = "x";
    expect(createSeed().events[0]!.title.ar).not.toBe("x");
  });
});
