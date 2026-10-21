import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/** Next.js 16 "proxy" (formerly middleware): redirects `/` to `/ar` and negotiates the locale prefix. */
export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
