import type { NextConfig } from "next";

/**
 * `next-intl/plugin` is intentionally not used: its entry point eagerly requires `@swc/core`
 * (only needed for next-intl's experimental message extraction), and that native binary
 * fails to load on this Windows machine. Without the experimental features, the plugin does
 * exactly one thing under Turbopack — alias `next-intl/config` to our request config — so we
 * declare that alias directly. See TECH_DECISIONS.md.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    resolveAlias: {
      "next-intl/config": "./src/i18n/request.ts",
    },
  },
};

export default nextConfig;
