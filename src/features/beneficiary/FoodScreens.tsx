"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCurrentUser, useDemoStore } from "@/data/store";
import { normalizeDigits } from "@/domain/newEvent";
import {
  ACTIVE_REQUEST,
  acceptedUnits,
  listingAvailability,
  listingRemaining,
  selectPublicListings,
} from "@/domain/selectors/beneficiary";
import type { DemoDataset, DemoUser, FoodListing, ListingCategory } from "@/domain/types";
import { createRequest } from "@/domain/workflow/beneficiary";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/Choice";
import { DetailList } from "@/components/ui/DetailList";
import { Field, TextInput, describedBy } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { RecordCard } from "@/components/ui/RecordCard";
import { RequestStatusBadge } from "@/components/ui/RequestStatusBadge";
import { StateMessage } from "@/components/ui/StateMessage";
import { useFormatters } from "@/features/common/useFormatters";
import { useUnits } from "@/features/charity/Listings";

export function useBeneficiary() {
  const user = useCurrentUser();
  const data = useDemoStore((s) => s.data);
  return { user, data };
}

/* ================================================================ H1 / H9 */

/** Figma H1 — listings published by charities after review; general area only, no personal data. */
export function FoodHome() {
  const { user, data } = useBeneficiary();
  if (!user || !data) return null;
  return <FoodHomeView data={data} />;
}

function FoodHomeView({ data }: { data: DemoDataset }) {
  const t = useTranslations("beneficiary.home");
  const tc = useTranslations("charity.publish.categories");
  const [now] = useState(() => new Date());
  const [filter, setFilter] = useState<"all" | ListingCategory>("all");
  const listings = selectPublicListings(data, now);
  const categories = [...new Set(listings.map((l) => l.category))];
  const shown = filter === "all" ? listings : listings.filter((l) => l.category === filter);
  const anyOpen = listings.some((l) => ["available", "low"].includes(listingAvailability(data, l, now)));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <PageHeader className="mb-0" title={t("title")} subtitle={t("subtitle")} />
      <section
        aria-labelledby="tip-teaser"
        className="flex flex-col gap-2 rounded-lg border border-line bg-surface-alt p-4"
      >
        <h2 id="tip-teaser" className="flex items-center gap-2 text-small-strong text-heading">
          <Icon name="lightbulb" size={20} />
          {t("tipTitle")}
        </h2>
        <p className="text-small text-ink">{t("tipText")}</p>
        <ButtonLink href="/beneficiary/tip" variant="ghost" className="w-fit px-0!">
          {t("tipCta")}
        </ButtonLink>
      </section>
      {!anyOpen ? (
        // Figma H9 — nothing available right now.
        <Card>
          <StateMessage
            icon="package"
            title={t("emptyTitle")}
            body={t("emptyBody")}
            actions={<ButtonLink href="/beneficiary/report">{t("emptyCta")}</ButtonLink>}
          />
        </Card>
      ) : null}
      {listings.length ? (
        <>
          <FilterChips
            label={t("filterLabel")}
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all" as const, label: t("all", { count: listings.length }) },
              ...categories.map((c) => ({ value: c, label: tc(c) })),
            ]}
          />
          <ul className="grid gap-4 md:grid-cols-2">
            {shown.map((l) => (
              <li key={l.id}>
                <FoodCard data={data} listing={l} now={now} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/** Figma "Food Card": source, remaining with a bar, general area, pickup window, details CTA. */
function FoodCard({ data, listing, now }: { data: DemoDataset; listing: FoodListing; now: Date }) {
  const t = useTranslations("beneficiary.home");
  const tn = useTranslations("beneficiary.unitName");
  const locale = useLocale() as Locale;
  const f = useFormatters(data);
  const units = useUnits();
  const availability = listingAvailability(data, listing, now);
  const remaining = listingRemaining(data, listing);
  const handover = data.handovers.find((h) => h.id === listing.sourceHandoverId);
  const open = availability === "available" || availability === "low";
  return (
    <RecordCard
      href={open ? `/beneficiary/food/${listing.id}` : undefined}
      title={
        <>
          {listing.title[locale]} · <bdi>{listing.id}</bdi>
        </>
      }
      badge={<RequestStatusBadge status={availability} />}
      meta={[
        {
          icon: "charities",
          text: t("from", { charity: f.orgName(listing.charityId), event: handover?.eventId ?? "—" }),
        },
        {
          icon: "package",
          text: remaining
            ? t("remaining", {
                left: f.n(remaining),
                total: units(listing.totalUnits, listing.unitLabel),
                kg: f.n(listing.unitKg),
                unit: tn(listing.unitLabel),
              })
            : t("soldOut", { total: units(listing.totalUnits, listing.unitLabel) }),
        },
        { icon: "location", text: t("area", { area: listing.area[locale] }) },
        {
          icon: "time",
          text:
            availability === "ended" || (availability === "sold_out" && Date.parse(listing.pickupEnd) < now.getTime())
              ? t("ended")
              : t("pickup", {
                  date: formatDate(listing.pickupStart, locale),
                  range: f.timeRange(listing.pickupStart, listing.pickupEnd),
                }),
        },
      ]}
    >
      <div className="flex w-full flex-col gap-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-alt" aria-hidden="true">
          <div
            className="h-full rounded-full bg-action"
            style={{ width: `${Math.round((remaining / listing.totalUnits) * 100)}%` }}
          />
        </div>
        {open ? (
          <ButtonLink
            href={`/beneficiary/food/${listing.id}`}
            variant="secondary"
            aria-label={t("detailsLabel", { listing: listing.id })}
          >
            {t("details")}
          </ButtonLink>
        ) : (
          <Button variant="secondary" disabled>
            {t("notAvailable")}
          </Button>
        )}
      </div>
    </RecordCard>
  );
}

/* ================================================================ H2 */

/** Figma H2 / H2b — details and a request that can never exceed what remains or the per-request limit. */
export function FoodDetail({ listingId }: { listingId: string }) {
  const t = useTranslations("beneficiary.detail");
  const { user, data } = useBeneficiary();
  if (!user || !data) return null;
  const listing = data.listings.find((l) => l.id === listingId && l.status === "active");
  if (!listing) {
    return (
      <StateMessage
        asPage
        icon="alert"
        title={t("notFound")}
        actions={<ButtonLink href="/beneficiary">{t("back")}</ButtonLink>}
      />
    );
  }
  return <FoodDetailView key={listing.id} data={data} user={user} listing={listing} />;
}

function FoodDetailView({ data, user, listing }: { data: DemoDataset; user: DemoUser; listing: FoodListing }) {
  const t = useTranslations("beneficiary.detail");
  const tn = useTranslations("beneficiary.unitName");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const dispatch = useDemoStore((s) => s.dispatch);
  const f = useFormatters(data);
  const units = useUnits();
  const [now] = useState(() => new Date());
  const availability = listingAvailability(data, listing, now);
  const remaining = listingRemaining(data, listing);
  const handover = data.handovers.find((h) => h.id === listing.sourceHandoverId);
  const open = data.requests.find(
    (r) => r.listingId === listing.id && r.beneficiaryId === user.id && ACTIVE_REQUEST.includes(r.status),
  );
  const maxPick = Math.min(listing.perRequestLimit, remaining);
  const [qty, setQty] = useState(maxPick >= 2 ? "2" : maxPick >= 1 ? "1" : "");
  const n = Number(normalizeDigits(qty).trim());
  const valid = Number.isInteger(n) && n >= 1;
  const error = !qty.trim()
    ? t("errors.required")
    : !valid
      ? t("errors.whole")
      : n > listing.perRequestLimit || n > remaining
        ? t("errors.over", {
            n: f.n(n),
            left: units(remaining, listing.unitLabel),
            limit: f.n(listing.perRequestLimit),
          })
        : null;
  const canSend = (availability === "available" || availability === "low") && !open && !error;

  const send = () => {
    const r = dispatch((c) => createRequest(c, listing.id, n), { flashOn: "/beneficiary/requests" });
    if (r.ok) router.push("/beneficiary/requests");
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader
        className="mb-0"
        back={{ href: "/beneficiary", label: t("back") }}
        title={listing.title[locale]}
        badge={<RequestStatusBadge status={availability} />}
      />
      <Card className="p-5">
        <DetailList
          stacked
          items={[
            {
              label: t("source"),
              value: t("sourceValue", {
                event: handover?.eventId ?? "—",
                total: f.kg(listing.totalUnits * listing.unitKg),
                units: units(listing.totalUnits, listing.unitLabel),
                kg: f.n(listing.unitKg),
              }),
            },
            {
              label: t("availableNow"),
              value: t("availableValue", {
                left: units(remaining, listing.unitLabel),
                kg: f.kg(remaining * listing.unitKg),
                taken: units(acceptedUnits(data, listing), listing.unitLabel),
              }),
            },
            { label: t("area"), value: t("areaValue", { area: listing.area[locale] }) },
            {
              label: t("pickup"),
              value: `${formatDate(listing.pickupStart, locale)} · ${f.timeRange(listing.pickupStart, listing.pickupEnd)}`,
            },
            {
              label: t("instructions"),
              value: t("instructionsValue", { limit: units(listing.perRequestLimit, listing.unitLabel) }),
            },
          ]}
        />
      </Card>
      {open ? (
        <div className="flex flex-col gap-3 rounded-md bg-selected p-4">
          <p className="text-small text-heading">
            {t("alreadyRequested", { request: open.id, units: units(open.units, listing.unitLabel) })}
          </p>
          <ButtonLink href="/beneficiary/requests" variant="secondary" className="w-fit">
            {t("goRequests")}
          </ButtonLink>
        </div>
      ) : availability === "available" || availability === "low" ? (
        <Card className="flex flex-col gap-4 p-5">
          <Field
            id="req-qty"
            label={t("qtyLabel", { unit: tn(`${listing.unitLabel}Plural`) })}
            required
            error={qty.trim() && error ? error : undefined}
            hint={
              valid && !error
                ? t("qtyHint", {
                    units: units(n, listing.unitLabel),
                    kg: f.kg(n * listing.unitKg),
                    limit: units(listing.perRequestLimit, listing.unitLabel),
                  })
                : undefined
            }
          >
            <TextInput
              id="req-qty"
              inputMode="numeric"
              value={qty}
              invalid={Boolean(qty.trim() && error)}
              aria-describedby={describedBy("req-qty", {
                error: qty.trim() ? (error ?? undefined) : undefined,
                hint: !error ? "x" : undefined,
              })}
              onChange={(e) => setQty(e.target.value)}
            />
          </Field>
          <div role="group" aria-label={t("quickPick")} className="flex flex-wrap gap-2">
            {Array.from({ length: Math.max(0, maxPick) }, (_, i) => i + 1).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={n === k}
                onClick={() => setQty(String(k))}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-full border px-4 text-small-strong",
                  n === k
                    ? "border-action bg-selected text-heading"
                    : "border-line bg-surface text-muted hover:text-heading",
                )}
              >
                {units(k, listing.unitLabel)}
              </button>
            ))}
          </div>
          <p className="flex items-start gap-2 rounded-md bg-selected px-4 py-3 text-caption text-heading">
            <Icon name="info" size={16} className="mt-px shrink-0" />
            <span>{t("note")}</span>
          </p>
          <Button fullWidth disabled={!canSend} onClick={send}>
            {t("send")}
          </Button>
        </Card>
      ) : (
        <p className="rounded-md bg-surface-alt px-4 py-3 text-small text-muted">{t("closed")}</p>
      )}
    </div>
  );
}
