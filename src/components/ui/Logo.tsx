import Image from "next/image";
import type { Locale } from "@/i18n/routing";

/** Official compact logo files (copied from brand/assets/logo). Never recoloured; `reverse` is for Forest surfaces. */
const RATIO = { ar: 362 / 92, en: 369 / 92 } as const;

interface LogoProps {
  locale: Locale;
  tone?: "color" | "reverse";
  width: number;
  priority?: boolean;
}

export function Logo({ locale, tone = "color", width, priority }: LogoProps) {
  return (
    <Image
      src={`/brand/logo/hafez-${locale}-compact-${tone}.svg`}
      alt={locale === "ar" ? "حفيظ" : "Hafez"}
      width={width}
      height={Math.round(width / RATIO[locale])}
      priority={priority}
      unoptimized
    />
  );
}
