"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DEMO_CONFIG } from "@/config/demo";
import { useDemoStore } from "@/data/store";
import { eventDateOptions, timeSlots } from "@/domain/newEvent";
import { can } from "@/domain/permissions";
import { acceptedUnits, distributedKg, listingAvailability, listingRemaining } from "@/domain/selectors/beneficiary";
import { selectCharityListings, selectListableHandovers, selectListingRequests } from "@/domain/selectors/charity";
import { LISTING_CATEGORIES, REQUEST_REJECT_REASONS } from "@/domain/types";
import type {
  DemoDataset,
  DemoUser,
  FoodListing,
  FoodRequest,
  ListingCategory,
  LocalizedText,
  RequestRejectReason,
} from "@/domain/types";
import { decideRequest, publishListing } from "@/domain/workflow/charity";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, Panel } from "@/components/ui/Card";
import { DetailList } from "@/components/ui/DetailList";
import { Field, SelectInput, TextInput, describedBy } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { RecordCard } from "@/components/ui/RecordCard";
import { RequestStatusBadge } from "@/components/ui/RequestStatusBadge";
import { StateMessage } from "@/components/ui/StateMessage";
import { formatDate } from "@/lib/format";
import { useFormatters } from "@/features/common/useFormatters";
import { useCharity } from "./Opportunities";

const OFFSET = DEMO_CONFIG.newEvent.utcOffset;

/** Units with Arabic plural forms ("3 عبوات", "10 عبوات", "2 عبوة"…). */
export function useUnits() {
  const t = useTranslations("charity.units");
  return (n: number, label: "box" | "bag") => t(label, { count: n });
}

/** General areas offered for listings and reports — districts of the demo city (never an exact address). */
export function useAreaOptions(data: DemoDataset): LocalizedText[] {
  return useMemo(() => {
    const seen = new Map<string, LocalizedText>();
    for (const o of data.organizations) if (o.district) seen.set(o.district.en, o.district);
    return [...seen.values()];
  }, [data]);
}

/* ================================================================ list */

export function ListingsScreen() {
  const { user, data } = useCharity();
  if (!user || !data) return null;
  return <ListingsList data={data} user={user} />;
}

function ListingsList({ data, user }: { data: DemoDataset; user: DemoUser }) {
  const t = useTranslations("charity.listings");
  const locale = useLocale() as Locale;
  const units = useUnits();
  const listings = selectCharityListings(data, user.organizationId!);
  const now = new Date();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        crumbs={t("crumbs")}
        title={t("title")}
        subtitle={t("subtitle")}
        actions={<ButtonLink href="/charity/listings/new">{t("publish")}</ButtonLink>}
      />
      {listings.length === 0 ? (
        <Card>
          <StateMessage icon="utensils" title={t("emptyTitle")} body={t("emptyBody")} />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {listings.map((l) => {
            const pending = data.requests.filter((r) => r.listingId === l.id && r.status === "pending").length;
            return (
              <li key={l.id}>
                <RecordCard
                  href={`/charity/listings/${l.id}`}
                  highlight={pending > 0}
                  title={
                    <>
                      {l.title[locale]} · <bdi>{l.id}</bdi>
                    </>
                  }
                  badge={<RequestStatusBadge status={listingAvailability(data, l, now)} />}
                  meta={[
                    {
                      icon: "package",
                      text: t("remaining", {
                        left: units(listingRemaining(data, l), l.unitLabel),
                        total: units(l.totalUnits, l.unitLabel),
                      }),
                    },
                    { icon: "location", text: l.area[locale] },
                    { icon: "clipboard", text: t("pendingCount", { count: pending }) },
                  ]}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ================================================================ D6 detail */

export function ListingDetail({ listingId }: { listingId: string }) {
  const t = useTranslations("charity.listings");
  const { user, data } = useCharity();
  if (!user || !data) return null;
  const listing = data.listings.find((l) => l.id === listingId && l.charityId === user.organizationId);
  if (!listing) {
    return (
      <StateMessage
        asPage
        icon="alert"
        title={t("notFound")}
        actions={<ButtonLink href="/charity/listings">{t("back")}</ButtonLink>}
      />
    );
  }
  return <ListingView data={data} user={user} listing={listing} />;
}

function ListingView({ data, user, listing }: { data: DemoDataset; user: DemoUser; listing: FoodListing }) {
  const t = useTranslations("charity.listings");
  const locale = useLocale() as Locale;
  const f = useFormatters(data);
  const units = useUnits();
  const requests = selectListingRequests(data, listing.id);
  const handover = data.handovers.find((h) => h.id === listing.sourceHandoverId);
  const accepted = acceptedUnits(data, listing);
  const remaining = listingRemaining(data, listing);
  const holding = requests.filter((r) => ["accepted", "ready", "completed", "partial"].includes(r.status));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        back={{ href: "/charity/listings", label: t("back") }}
        title={t("detailTitle")}
        subtitle={t("subtitle")}
        actions={<ButtonLink href="/charity/listings/new">{t("publish")}</ButtonLink>}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Panel title={t("requestsTitle", { listing: listing.id })} titleId="l-requests">
          <p className="-mt-2 mb-4 text-small text-muted">{t("requestsHint")}</p>
          {requests.length === 0 ? (
            <p className="text-small text-muted">{t("noRequests")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {requests.map((r) => (
                <li key={r.id}>
                  <RequestRow data={data} user={user} listing={listing} request={r} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t("listingTitle", { listing: listing.id })} titleId="l-listing">
          <div className="-mt-2 mb-2 flex items-center justify-between gap-3">
            <p className="text-body-strong text-heading">{listing.title[locale]}</p>
            <RequestStatusBadge status={listingAvailability(data, listing, new Date())} />
          </div>
          <DetailList
            items={[
              {
                label: t("source"),
                value: handover
                  ? t("sourceValue", { event: handover.eventId, qty: f.kg(handover.actualQuantity) })
                  : "—",
              },
              {
                label: t("packaging"),
                value: t("packagingValue", {
                  units: units(listing.totalUnits, listing.unitLabel),
                  kg: f.n(listing.unitKg),
                  total: f.kg(listing.totalUnits * listing.unitKg),
                }),
              },
              {
                label: t("accepted"),
                value: holding.length
                  ? `${units(accepted, listing.unitLabel)} (${holding.map((r) => `${r.id} ${t(`statusShort.${r.status}`)}`).join(locale === "ar" ? "، " : ", ")})`
                  : units(0, listing.unitLabel),
              },
              {
                label: t("remainingLabel"),
                value: t("remainingValue", {
                  total: f.n(listing.totalUnits),
                  accepted: f.n(accepted),
                  left: units(remaining, listing.unitLabel),
                }),
              },
              { label: t("area"), value: t("areaValue", { area: listing.area[locale] }) },
              {
                label: t("window"),
                value: `${formatDate(listing.pickupStart, locale)} · ${f.timeRange(listing.pickupStart, listing.pickupEnd)}`,
              },
              {
                label: t("limit"),
                value: t("limitValue", { units: units(listing.perRequestLimit, listing.unitLabel) }),
              },
            ]}
          />
          <Notice tone="info" className="mt-4">
            {t("pendingNote")}
          </Notice>
          <div className="mt-4 rounded-md bg-selected p-4 text-small text-heading">
            <p className="mb-1 text-small-strong">{t("impactTitle")}</p>
            <p>
              {t("impactBody", {
                event: handover?.eventId ?? "—",
                delivered: f.kg(handover?.actualQuantity ?? 0),
                distributed: f.kg(distributedKg(data, listing)),
              })}
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function RequestRow({
  data,
  user,
  listing,
  request,
}: {
  data: DemoDataset;
  user: DemoUser;
  listing: FoodListing;
  request: FoodRequest;
}) {
  const t = useTranslations("charity.listings");
  const dispatch = useDemoStore((s) => s.dispatch);
  const f = useFormatters(data);
  const units = useUnits();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<RequestRejectReason>(
    request.units > listing.perRequestLimit ? "over_limit" : "sold_out",
  );
  const [error, setError] = useState<string | null>(null);
  const canDecide = can(user, "request.decide", { kind: "request", request, listing });
  const withinLimit = request.units <= listing.perRequestLimit;

  const accept = () => {
    const r = dispatch((c) => decideRequest(c, request.id, { accept: true }));
    if (!r.ok)
      setError(
        t(
          r.error === "over_limit"
            ? "errors.overLimit"
            : r.error === "over_remaining"
              ? "errors.overRemaining"
              : "errors.generic",
        ),
      );
  };
  const reject = () => {
    const r = dispatch((c) => decideRequest(c, request.id, { accept: false, reason }));
    if (r.ok) setRejecting(false);
  };

  return (
    <div data-request={request.id} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-small-strong text-heading">
            {t("requestLine", {
              units: units(request.units, listing.unitLabel),
              kg: f.kg(request.units * listing.unitKg),
            })}{" "}
            · <bdi>{request.id}</bdi>
          </p>
          <p className="text-caption text-muted">
            {f.userName(request.beneficiaryId)} · {t("sentAt", { at: f.shortDateTime(request.createdAt) })}
            {request.status === "pending" ? ` · ${withinLimit ? t("withinLimit") : t("overLimit")}` : ""}
            {request.status === "rejected" && request.rejectReason
              ? ` · ${t("rejectedFor", { reason: t(`rejectReasons.${request.rejectReason}`) })}`
              : ""}
            {request.status === "completed" ? ` · ${t("beneficiaryConfirmed")}` : ""}
          </p>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>
      {error ? <p className="text-caption text-danger">{error}</p> : null}
      {canDecide ? (
        rejecting ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field id={`rr-${request.id}`} label={t("rejectReason")} className="sm:flex-1">
              <SelectInput
                id={`rr-${request.id}`}
                value={reason}
                onChange={(e) => setReason(e.target.value as RequestRejectReason)}
              >
                {REQUEST_REJECT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`rejectReasons.${r}`)}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Button variant="danger" onClick={reject}>
              {t("confirmReject")}
            </Button>
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              {t("cancel")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={accept} aria-label={t("acceptLabel", { request: request.id })}>
              {t("accept")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setRejecting(true)}
              aria-label={t("rejectLabel", { request: request.id })}
            >
              {t("reject")}
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}

/* ================================================================ publish */

export function PublishListingScreen() {
  const { user, data } = useCharity();
  if (!user || !data) return null;
  return <PublishForm data={data} user={user} />;
}

function PublishForm({ data, user }: { data: DemoDataset; user: DemoUser }) {
  const t = useTranslations("charity.publish");
  const tl = useTranslations("charity.listings");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const dispatch = useDemoStore((s) => s.dispatch);
  const f = useFormatters(data);
  const handovers = selectListableHandovers(data, user.organizationId!);
  const areas = useAreaOptions(data);
  const [now] = useState(() => new Date());
  const dates = useMemo(() => eventDateOptions(now).slice(0, 15), [now]);
  const slots = useMemo(() => timeSlots(), []);
  const [v, setV] = useState({
    handover: handovers[0]?.handover.id ?? "",
    title: "",
    category: "meals" as ListingCategory,
    unitLabel: "box" as "box" | "bag",
    unitKg: String(DEMO_CONFIG.beneficiary.unitKg),
    totalUnits: "",
    limit: String(DEMO_CONFIG.beneficiary.perRequestLimit),
    area: areas[0]?.en ?? "",
    date: dates[1] ?? dates[0] ?? "",
    start: "13:00",
    end: "16:00",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof v, value: string) => setV((x) => ({ ...x, [k]: value }));

  if (handovers.length === 0) {
    return (
      <StateMessage
        asPage
        icon="pickup"
        title={t("noHandoversTitle")}
        body={t("noHandoversBody")}
        actions={<ButtonLink href="/charity/listings">{tl("back")}</ButtonLink>}
      />
    );
  }
  const selected = handovers.find((h) => h.handover.id === v.handover);

  const submit = () => {
    const area = areas.find((a) => a.en === v.area) ?? { ar: "", en: "" };
    const r = dispatch(
      (c) =>
        publishListing(c, {
          sourceHandoverId: v.handover,
          title: v.title,
          category: v.category,
          unitLabel: v.unitLabel,
          unitKg: Number(v.unitKg),
          totalUnits: Number(v.totalUnits),
          perRequestLimit: Number(v.limit),
          area,
          pickupStart: `${v.date}T${v.start}:00${OFFSET}`,
          pickupEnd: `${v.date}T${v.end}:00${OFFSET}`,
        }),
      { flashOn: "/charity/listings" },
    );
    if (r.ok) router.push("/charity/listings");
    else setErrors(r.fields ?? { form: "generic" });
  };
  const err = (k: string) => (errors[k] ? t(`errors.${k}_${errors[k]}`) : undefined);
  const a11y = (id: string, k: string) => ({
    id,
    invalid: Boolean(errors[k]),
    "aria-describedby": describedBy(id, { error: err(k) }),
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader
        className="mb-0"
        back={{ href: "/charity/listings", label: tl("back") }}
        title={t("title")}
        subtitle={t("subtitle")}
      />
      <Card className="flex flex-col gap-5 p-5">
        <Field id="pl-handover" label={t("handover")} required error={err("sourceHandoverId")}>
          <SelectInput
            {...a11y("pl-handover", "sourceHandoverId")}
            value={v.handover}
            onChange={(e) => set("handover", e.target.value)}
          >
            {handovers.map(({ handover, availableKg }) => (
              <option key={handover.id} value={handover.id}>
                {t("handoverOption", {
                  event: handover.eventId,
                  qty: f.kg(handover.actualQuantity),
                  left: f.kg(availableKg),
                })}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="pl-title" label={t("titleLabel")} required error={err("title")} hint={t("titleHint")}>
          <TextInput
            {...a11y("pl-title", "title")}
            value={v.title}
            placeholder={t("titlePlaceholder")}
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="pl-category" label={t("category")} required>
            <SelectInput id="pl-category" value={v.category} onChange={(e) => set("category", e.target.value)}>
              {LISTING_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`categories.${c}`)}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id="pl-unit" label={t("unitLabel")} required>
            <SelectInput id="pl-unit" value={v.unitLabel} onChange={(e) => set("unitLabel", e.target.value)}>
              <option value="box">{t("unitBox")}</option>
              <option value="bag">{t("unitBag")}</option>
            </SelectInput>
          </Field>
          <Field id="pl-unitkg" label={t("unitKg")} required error={err("unitKg")}>
            <TextInput
              {...a11y("pl-unitkg", "unitKg")}
              inputMode="decimal"
              value={v.unitKg}
              onChange={(e) => set("unitKg", e.target.value)}
            />
          </Field>
          <Field
            id="pl-total"
            label={t("totalUnits")}
            required
            error={err("totalUnits")}
            hint={selected ? t("totalHint", { left: f.kg(selected.availableKg) }) : undefined}
          >
            <TextInput
              {...a11y("pl-total", "totalUnits")}
              inputMode="numeric"
              value={v.totalUnits}
              onChange={(e) => set("totalUnits", e.target.value)}
            />
          </Field>
          <Field id="pl-limit" label={t("limit")} required error={err("perRequestLimit")} hint={t("limitHint")}>
            <TextInput
              {...a11y("pl-limit", "perRequestLimit")}
              inputMode="numeric"
              value={v.limit}
              onChange={(e) => set("limit", e.target.value)}
            />
          </Field>
          <Field id="pl-area" label={t("area")} required hint={t("areaHint")} error={err("area")}>
            <SelectInput id="pl-area" value={v.area} onChange={(e) => set("area", e.target.value)}>
              {areas.map((a) => (
                <option key={a.en} value={a.en}>
                  {a[locale]}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id="pl-date" label={t("date")} required>
            <SelectInput id="pl-date" value={v.date} onChange={(e) => set("date", e.target.value)}>
              {dates.map((d) => (
                <option key={d} value={d}>
                  {formatDate(`${d}T12:00:00${OFFSET}`, locale)}
                </option>
              ))}
            </SelectInput>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="pl-start" label={t("start")} required>
              <SelectInput id="pl-start" value={v.start} onChange={(e) => set("start", e.target.value)}>
                {slots.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field id="pl-end" label={t("end")} required error={err("pickupEnd")}>
              <SelectInput {...a11y("pl-end", "pickupEnd")} value={v.end} onChange={(e) => set("end", e.target.value)}>
                {slots.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
        </div>
        <Notice tone="info">{t("note")}</Notice>
      </Card>
      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
        <Button onClick={submit}>{t("submit")}</Button>
        <ButtonLink href="/charity/listings" variant="ghost">
          {tl("cancel")}
        </ButtonLink>
      </div>
    </div>
  );
}
