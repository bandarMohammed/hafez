"use client";

import { useEffect } from "react";
import { useDemoStore } from "@/data/store";

/** Loads demo data from browser storage once on the client (never during server render). */
export function StoreInit() {
  const init = useDemoStore((s) => s.init);
  useEffect(() => {
    init();
  }, [init]);
  return null;
}
