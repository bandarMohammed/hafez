import { DEMO_CONFIG } from "@/config/demo";
import type { DemoDataset } from "@/domain/types";
import { datasetSchema } from "./schema";
import { createSeed } from "./seed";

/**
 * Repository boundary: UI and stores depend on this interface only, so the local demo storage can be
 * replaced later (e.g. a real API) without touching components. No secrets or real personal data are stored.
 */
export type LoadResult = { ok: true; data: DemoDataset; source: "storage" | "seed" } | { ok: false; reason: "corrupt" };

export interface DemoRepository {
  load(): LoadResult;
  save(data: DemoDataset): void;
  /** Restores the initial demo data. Touches only this app's own storage key. */
  reset(): DemoDataset;
  getSessionUserId(): string | null;
  setSessionUserId(id: string | null): void;
}

/** Minimal Storage subset — lets tests inject an in-memory implementation. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createLocalRepository(storage: KeyValueStorage): DemoRepository {
  const { data: dataKey, session: sessionKey } = DEMO_CONFIG.storageKeys;

  return {
    load() {
      const raw = storage.getItem(dataKey);
      if (raw === null) {
        const seed = createSeed();
        storage.setItem(dataKey, JSON.stringify(seed));
        return { ok: true, data: seed, source: "seed" };
      }
      try {
        const parsed = datasetSchema.safeParse(JSON.parse(raw));
        if (!parsed.success) return { ok: false, reason: "corrupt" };
        // Data from an older seed version is discarded instead of being half-migrated.
        if (parsed.data.version !== DEMO_CONFIG.dataVersion) {
          const seed = createSeed();
          storage.setItem(dataKey, JSON.stringify(seed));
          return { ok: true, data: seed, source: "seed" };
        }
        return { ok: true, data: parsed.data, source: "storage" };
      } catch {
        return { ok: false, reason: "corrupt" };
      }
    },
    save(data) {
      storage.setItem(dataKey, JSON.stringify(data));
    },
    reset() {
      const seed = createSeed();
      storage.setItem(dataKey, JSON.stringify(seed));
      return seed;
    },
    getSessionUserId() {
      return storage.getItem(sessionKey);
    },
    setSessionUserId(id) {
      if (id === null) storage.removeItem(sessionKey);
      else storage.setItem(sessionKey, id);
    },
  };
}

/** In-memory storage for tests and for browsers where localStorage is unavailable (private mode). */
export function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/** Browser repository; falls back to memory if localStorage throws (blocked storage). */
export function createBrowserRepository(): DemoRepository {
  try {
    const probe = "__hafez_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return createLocalRepository(window.localStorage);
  } catch {
    return createLocalRepository(createMemoryStorage());
  }
}
