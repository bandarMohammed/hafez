import { notFound } from "next/navigation";

/** Any unknown localized path renders the localized 404 (next-intl recommendation). */
export default function CatchAll() {
  notFound();
}
