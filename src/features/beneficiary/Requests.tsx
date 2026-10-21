"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useDemoStore } from "@/data/store";
import { can } from "@/domain/permissions";
import { ACTIVE_REQUEST, selectMyRequests } from "@/domain/selectors/beneficiary";
import type { DemoDataset, DemoUser, FoodListing, FoodRequest } from "@/domain/types";
import { confirmRequest } from "@/domain/workflow/beneficiary";
import type { ConfirmInput } from "@/domain/workflow/beneficiary";
import { normalizeDigits } from "@/domain/newEvent";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { DEMO_CONFIG } from "@/config/demo";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FilterChips, RadioCards } from "@/components/ui/Choice";
import { Field, TextArea, TextInput, describedBy } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequestStatusBadge } from "@/components/ui/RequestStatusBadge";
import { StateMessage } from "@/components/ui/StateMessage";
import { useFormatters } from "@/features/common/useFormatters";
import { useUnits } from "@/features/charity/Listings";
import { useBeneficiary } from "./FoodScreens";

/** "أرز ودجاج · 2 عبوة (4 كجم) · R-07" — the record code always sits at the end (Figma bidi fix #53). */
function RequestTitle({
  data,
  request: r,
  listing,
}: {
  data: DemoDataset;
  request: FoodRequest;
  listing?: FoodListing;
}) {
  const locale = useLocale() as Locale;
  const f = useFormatters(data);
  const units = useUnits();
  return (
    <>
      {listing?.title[locale] ?? "—"} · {units(r.units, listing?.unitLabel ?? "box")}
      {listing ? ` (${f.kg(r.units * listing.unitKg)})` : ""} · <bdi>{r.id}</bdi>
    </>
  );
}

/* ================================================================ H3 */

export function MyRequestsScreen() {
  const { user, data } = useBeneficiary();
  if (!user || !data) return null;
  return <MyRequests data={data} user={user} />;
}

function MyRequests({ data, user }: { data: DemoDataset; user: DemoUser }) {
  const t = useTranslations("beneficiary.requests");
  const [filter, setFilter] = useState<"all" | "active" | "closed">("all");
  const mine = selectMyRequests(data, user.id);
  const active = mine.filter((r) => ACTIVE_REQUEST.includes(r.status));
  const closed = mine.filter((r) => !ACTIVE_REQUEST.includes(r.status));
  const shown = filter === "active" ? active : filter === "closed" ? closed : mine;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader className="mb-0" title={t("title")} subtitle={t("subtitle")} />
      {mine.length ? (
        <>
          <FilterChips
            label={t("filterLabel")}
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: t("all", { count: mine.length }) },
              { value: "active", label: t("active", { count: active.length }) },
              { value: "closed", label: t("closed", { count: closed.length }) },
            ]}
          />
          {shown.length ? (
            <ul className="flex flex-col gap-3">
              {shown.map((r) => (
                <li key={r.id}>
                  <RequestItem data={data} user={user} request={r} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-md bg-surface-alt px-4 py-3 text-small text-muted">{t("noneInFilter")}</p>
          )}
        </>
      ) : (
        <Card>
          <StateMessage
            icon="clipboard"
            title={t("emptyTitle")}
            body={t("emptyBody")}
            actions={<ButtonLink href="/beneficiary">{t("browse")}</ButtonLink>}
          />
        </Card>
      )}
    </div>
  );
}

function RequestItem({ data, user, request: r }: { data: DemoDataset; user: DemoUser; request: FoodRequest }) {
  const t = useTranslations("beneficiary.requests");
  const tr = useTranslations("charity.listings.rejectReasons");
  const locale = useLocale() as Locale;
  const f = useFormatters(data);
  const units = useUnits();
  const listing = data.listings.find((l) => l.id === r.listingId);
  const points = data.points.find((p) => p.reason === "request_confirmed" && p.sourceId === r.id);
  const pickup = listing
    ? `${f.date(listing.pickupStart)} · ${f.timeRange(listing.pickupStart, listing.pickupEnd)}`
    : "—";
  const confirmable = Boolean(listing && can(user, "request.confirm", { kind: "request", request: r, listing }));

  const lines: Array<{ text: string; tone?: "strong" | "success" }> = [];
  switch (r.status) {
    case "pending":
      lines.push({ text: t("lines.pending", { at: f.shortDateTime(r.createdAt) }) });
      break;
    case "accepted":
    case "ready":
      lines.push({ text: t("lines.accepted", { charity: f.orgName(listing?.charityId), pickup }) });
      lines.push({ text: t("lines.pickupPoint", { area: listing?.area[locale] ?? "—" }), tone: "strong" });
      break;
    case "completed":
      lines.push({
        text: t("lines.completed", { at: f.date(r.confirmation?.at ?? r.createdAt), points: f.n(points?.points ?? 0) }),
        tone: "success",
      });
      break;
    case "partial":
      lines.push({
        text: t("lines.partial", {
          received: units(r.confirmation?.receivedUnits ?? 0, listing?.unitLabel ?? "box"),
          units: units(r.units, listing?.unitLabel ?? "box"),
        }),
      });
      break;
    case "not_received":
      lines.push({ text: t("lines.notReceived") });
      break;
    case "rejected":
      lines.push({ text: t("lines.rejected", { reason: r.rejectReason ? tr(r.rejectReason) : "—" }) });
      break;
    case "cancelled":
      lines.push({ text: t("lines.cancelled") });
      break;
  }

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-body-strong text-heading">
          <RequestTitle data={data} request={r} listing={listing} />
        </h2>
        <RequestStatusBadge status={r.status} className="shrink-0" />
      </div>
      {lines.map((l, i) => (
        <p
          key={i}
          className={cn(
            "text-small",
            l.tone === "success" ? "text-success" : l.tone === "strong" ? "text-ink" : "text-muted",
          )}
        >
          {l.text}
        </p>
      ))}
      {confirmable ? (
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <ButtonLink
            href={`/beneficiary/requests/${r.id}/confirm`}
            className="sm:flex-1"
            aria-label={t("confirmLabel", { request: r.id })}
          >
            {t("confirm")}
          </ButtonLink>
          <ButtonLink
            href={`/beneficiary/requests/${r.id}/confirm?issue=1`}
            variant="ghost"
            className="sm:flex-1"
            aria-label={t("problemLabel", { request: r.id })}
          >
            {t("problem")}
          </ButtonLink>
        </div>
      ) : null}
    </article>
  );
}

/* ================================================================ H7 */

/** Figma H7 — full pickup / partial / not received, optional rating and note. */
export function ConfirmPickupScreen({ requestId, issue }: { requestId: string; issue?: boolean }) {
  const t = useTranslations("beneficiary.confirm");
  const { user, data } = useBeneficiary();
  if (!user || !data) return null;
  const request = data.requests.find((r) => r.id === requestId && r.beneficiaryId === user.id);
  const listing = request && data.listings.find((l) => l.id === request.listingId);
  if (request && listing && request.confirmation) {
    // Already confirmed (also what the form shows the moment it saves, before navigation completes).
    return (
      <StateMessage
        asPage
        icon="check"
        title={t("doneTitle", { request: request.id })}
        body={t(`doneBody.${request.confirmation.kind}`)}
        actions={<ButtonLink href="/beneficiary/requests">{t("back")}</ButtonLink>}
      />
    );
  }
  if (!request || !listing || !can(user, "request.confirm", { kind: "request", request, listing })) {
    return (
      <StateMessage
        asPage
        icon="lock"
        tone="info"
        title={t("notAvailable")}
        body={t("notAvailableBody")}
        actions={<ButtonLink href="/beneficiary/requests">{t("back")}</ButtonLink>}
      />
    );
  }
  return <ConfirmForm key={request.id} data={data} request={request} listing={listing} issue={issue} />;
}

const RATINGS = ["excellent", "good", "needs_improvement"] as const;

function ConfirmForm({
  data,
  request,
  listing,
  issue,
}: {
  data: DemoDataset;
  request: FoodRequest;
  listing: FoodListing;
  issue?: boolean;
}) {
  const t = useTranslations("beneficiary.confirm");
  const router = useRouter();
  const dispatch = useDemoStore((s) => s.dispatch);
  const f = useFormatters(data);
  const units = useUnits();
  const [kind, setKind] = useState<ConfirmInput["kind"] | null>(issue ? "not_received" : null);
  const [received, setReceived] = useState("");
  const [rating, setRating] = useState<ConfirmInput["rating"]>(null);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const partialError = errors.receivedUnits ? t("errors.received", { max: f.n(request.units - 1) }) : undefined;

  const submit = () => {
    if (!kind) {
      setErrors({ kind: "required" });
      return;
    }
    const n = Number(normalizeDigits(received).trim());
    const r = dispatch(
      (c) =>
        confirmRequest(c, request.id, {
          kind,
          receivedUnits: kind === "partial" ? (received.trim() && Number.isFinite(n) ? n : null) : null,
          rating,
          note: note || null,
        }),
      { flashOn: "/beneficiary/requests" },
    );
    if (r.ok) router.push("/beneficiary/requests");
    else setErrors(r.fields ?? {});
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader
        className="mb-0"
        back={{ href: "/beneficiary/requests", label: t("back") }}
        title={t("title")}
        subtitle={t("subtitle")}
      />
      <Card className="flex flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-body-strong text-heading">
            <RequestTitle data={data} request={request} listing={listing} />
          </h2>
          <RequestStatusBadge status={request.status} className="shrink-0" />
        </div>
        <p className="text-small text-muted">
          {f.orgName(listing.charityId)} · {f.date(listing.pickupStart)} ·{" "}
          {f.timeRange(listing.pickupStart, listing.pickupEnd)}
        </p>
      </Card>
      <Card className="flex flex-col gap-5 p-5">
        <RadioCards
          name="confirm-kind"
          legend={t("kindLegend")}
          required
          value={kind}
          onChange={(k) => {
            setKind(k);
            setErrors({});
          }}
          error={errors.kind ? t("errors.kind") : undefined}
          errorId="confirm-kind-error"
          options={[
            {
              value: "full",
              title: t("full.title"),
              description: t("full.description", {
                units: units(request.units, listing.unitLabel),
                kg: f.kg(request.units * listing.unitKg),
                points: f.n(DEMO_CONFIG.points.requestConfirmed),
              }),
            },
            { value: "partial", title: t("partial.title"), description: t("partial.description") },
            { value: "not_received", title: t("notReceived.title"), description: t("notReceived.description") },
          ]}
        />
        {kind === "partial" ? (
          <Field
            id="confirm-received"
            label={t("receivedLabel", { units: units(request.units, listing.unitLabel) })}
            required
            error={partialError}
          >
            <TextInput
              id="confirm-received"
              inputMode="numeric"
              value={received}
              invalid={Boolean(partialError)}
              aria-describedby={describedBy("confirm-received", { error: partialError })}
              onChange={(e) => setReceived(e.target.value)}
            />
          </Field>
        ) : null}
        <div className="flex flex-col gap-2">
          <p id="confirm-rating" className="text-small-strong text-heading">
            {t("ratingLegend")}
          </p>
          <div role="group" aria-labelledby="confirm-rating" className="flex flex-wrap gap-2">
            {RATINGS.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={rating === k}
                onClick={() => setRating(rating === k ? null : k)}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-full border px-4 text-small-strong",
                  rating === k
                    ? "border-action bg-selected text-heading"
                    : "border-line bg-surface text-muted hover:text-heading",
                )}
              >
                {t(`ratings.${k}`)}
              </button>
            ))}
          </div>
        </div>
        <Field id="confirm-note" label={t("note")}>
          <TextArea
            id="confirm-note"
            value={note}
            placeholder={t("notePlaceholder")}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </Card>
      <div className="flex flex-col gap-3">
        <Button fullWidth onClick={submit}>
          {kind === "not_received" ? t("submitProblem") : t("submit")}
        </Button>
        <ButtonLink fullWidth variant="ghost" href="/beneficiary/requests">
          {t("back")}
        </ButtonLink>
      </div>
    </div>
  );
}
