import { addDays, riyadhDate } from "@/domain/newEvent";
import { distributedKg } from "@/domain/selectors/beneficiary";
import type { DemoDataset } from "@/domain/types";

/**
 * Impact dashboard numbers for the pitch page. Everything is derived from the shared records with the same rules
 * as the role screens: estimates are kept apart from documented quantities, and "distributed" counts only
 * beneficiary-confirmed pickups.
 */
export interface ImpactPoint {
  /** Riyadh calendar day, YYYY-MM-DD. */
  day: string;
  /** Cumulative documented rescue (halls + household reports), kg. */
  rescued: number;
  /** Cumulative beneficiary-confirmed distribution, kg. */
  distributed: number;
}

export interface ImpactSummary {
  events: number;
  /** C3 forecast reductions (planned − recommended) when the hall used the recommendation — an estimate. */
  avoidedKg: number;
  /** Expected surplus of published events — estimates, never counted as rescued. */
  expectedKg: number;
  /** Charity-confirmed handovers from halls. */
  hallsKg: number;
  /** Documented rescues of beneficiary surplus reports. */
  reportsKg: number;
  /** hallsKg + reportsKg. */
  rescuedKg: number;
  /** Packaged into listings for beneficiaries. */
  listedKg: number;
  distributedKg: number;
  /** Requests the beneficiary confirmed (full or partial). */
  confirmedPickups: number;
  pledges: number;
  /** Cumulative series per day, from the first documented record to `now`. */
  series: ImpactPoint[];
}

const DONE_EVENT = new Set(["collected", "closed"]);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function selectImpact(data: DemoDataset, now: Date): ImpactSummary {
  const collected = data.handovers.filter((h) => {
    const e = data.events.find((x) => x.id === h.eventId);
    return Boolean(e && DONE_EVENT.has(e.status));
  });
  const rescuedReports = data.reports.filter((r) => r.rescue);
  const confirmed = data.requests.filter((r) => r.status === "completed" || r.status === "partial");

  const avoidedKg = data.events.reduce((sum, e) => {
    const f = e.forecast;
    return f && f.decision === "use_recommended" ? sum + Math.max(0, f.plannedKgBefore - f.recommendedKg) : sum;
  }, 0);
  const expectedKg = data.events
    .filter((e) => e.status !== "registered")
    .reduce((sum, e) => sum + (e.expectedSurplusKg ?? 0), 0);
  const hallsKg = collected.reduce((sum, h) => sum + h.actualQuantity, 0);
  const reportsKg = rescuedReports.reduce((sum, r) => sum + (r.rescue?.actualKg ?? 0), 0);
  const listedKg = data.listings.reduce((sum, l) => sum + l.totalUnits * l.unitKg, 0);

  // Daily events → cumulative series.
  const day = (iso: string) => riyadhDate(new Date(iso));
  const rescuedOn: Array<[string, number]> = [
    ...collected.map((h): [string, number] => [day(h.charityConfirmedAt ?? h.handedOverAt), h.actualQuantity]),
    ...rescuedReports.map((r): [string, number] => [day(r.rescue!.documentedAt), r.rescue!.actualKg]),
  ];
  const distributedOn: Array<[string, number]> = confirmed.map((r) => {
    const l = data.listings.find((x) => x.id === r.listingId);
    return [day(r.confirmation?.at ?? r.createdAt), (r.confirmation?.receivedUnits ?? 0) * (l?.unitKg ?? 0)];
  });
  const days = [...rescuedOn, ...distributedOn].map(([d]) => d).sort();
  const series: ImpactPoint[] = [];
  if (days.length) {
    const today = riyadhDate(now);
    const last = days[days.length - 1]! > today ? days[days.length - 1]! : today;
    let rescued = 0;
    let distributed = 0;
    for (let d = days[0]!; d <= last; d = addDays(d, 1)) {
      rescued += rescuedOn.filter(([x]) => x === d).reduce((s, [, kg]) => s + kg, 0);
      distributed += distributedOn.filter(([x]) => x === d).reduce((s, [, kg]) => s + kg, 0);
      series.push({ day: d, rescued: round1(rescued), distributed: round1(distributed) });
    }
  }

  return {
    events: data.events.length,
    avoidedKg: round1(avoidedKg),
    expectedKg: round1(expectedKg),
    hallsKg: round1(hallsKg),
    reportsKg: round1(reportsKg),
    rescuedKg: round1(hallsKg + reportsKg),
    listedKg: round1(listedKg),
    distributedKg: round1(distributedKg(data)),
    confirmedPickups: confirmed.length,
    pledges: data.pledges.length,
    series,
  };
}
