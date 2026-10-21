import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Locale-aware navigation helpers — always use these instead of next/link or next/navigation. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
