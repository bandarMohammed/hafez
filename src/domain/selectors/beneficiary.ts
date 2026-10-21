import { DEMO_CONFIG } from "@/config/demo";
import type { DemoDataset, FoodListing, FoodRequest, PointsEntry, SurplusReport } from "../types";

const time = (iso: string) => Date.parse(iso);

/** Requests that hold units of a listing: accepted ones are deducted, pending ones are not (Figma D6). */
const HOLDS_UNITS: FoodRequest["status"][] = ["accepted", "ready", "completed", "partial"];

export function acceptedUnits(data: DemoDataset, listing: FoodListing): number {
  return data.requests
    .filter((r) => r.listingId === listing.id && HOLDS_UNITS.includes(r.status))
    .reduce((sum, r) => sum + (r.status === "partial" ? (r.confirmation?.receivedUnits ?? r.units) : r.units), 0);
}

export function listingRemaining(data: DemoDataset, listing: FoodListing): number {
  return Math.max(0, listing.totalUnits - acceptedUnits(data, listing));
}

/** kg already packaged into listings from one handover — a handover can't be listed twice. */
export function listedKgFromHandover(data: DemoDataset, handoverId: string): number {
  return data.listings
    .filter((l) => l.sourceHandoverId === handoverId)
    .reduce((sum, l) => sum + l.totalUnits * l.unitKg, 0);
}

export type ListingAvailability = "available" | "low" | "sold_out" | "ended";

export function listingAvailability(data: DemoDataset, listing: FoodListing, now: Date): ListingAvailability {
  if (listing.status === "archived" || time(listing.pickupEnd) < now.getTime()) {
    return listingRemaining(data, listing) === 0 ? "sold_out" : "ended";
  }
  const remaining = listingRemaining(data, listing);
  if (remaining === 0) return "sold_out";
  if (remaining <= DEMO_CONFIG.beneficiary.lowStockUnits) return "low";
  return "available";
}

/** H1 — published listings (archived ones hidden), open ones first then by pickup time. */
export function selectPublicListings(data: DemoDataset, now: Date): FoodListing[] {
  const rank = (l: FoodListing) => (["available", "low"].includes(listingAvailability(data, l, now)) ? 0 : 1);
  return data.listings
    .filter((l) => l.status === "active")
    .sort((a, b) => rank(a) - rank(b) || time(a.pickupStart) - time(b.pickupStart));
}

/** H3 — own requests only, newest first. */
export function selectMyRequests(data: DemoDataset, userId: string): FoodRequest[] {
  return data.requests.filter((r) => r.beneficiaryId === userId).sort((a, b) => time(b.createdAt) - time(a.createdAt));
}

/** H8 — own reports only, newest first. */
export function selectMyReports(data: DemoDataset, userId: string): SurplusReport[] {
  return data.reports.filter((r) => r.reporterId === userId).sort((a, b) => time(b.createdAt) - time(a.createdAt));
}

export const ACTIVE_REQUEST: FoodRequest["status"][] = ["pending", "accepted", "ready"];

/* ---------------------------------------------------------------- H5 shield & points */

export interface ShieldSummary {
  balance: number;
  level: "bronze" | "silver" | "gold";
  /** Points to the next level, null at gold. */
  toNext: number | null;
  nextAt: number | null;
  /** 0–1 progress inside the current level band. */
  progress: number;
  confirmedPickups: number;
  rescuedReports: number;
  history: PointsEntry[];
}

export function selectShield(data: DemoDataset, userId: string): ShieldSummary {
  const history = data.points.filter((p) => p.userId === userId).sort((a, b) => time(b.at) - time(a.at));
  const balance = history.reduce((s, p) => s + p.points, 0);
  const { silverAt, goldAt } = DEMO_CONFIG.points;
  const level = balance >= goldAt ? "gold" : balance >= silverAt ? "silver" : "bronze";
  const nextAt = level === "bronze" ? silverAt : level === "silver" ? goldAt : null;
  const floor = level === "bronze" ? 0 : level === "silver" ? silverAt : goldAt;
  return {
    balance,
    level,
    nextAt,
    toNext: nextAt === null ? null : nextAt - balance,
    progress: nextAt === null ? 1 : (balance - floor) / (nextAt - floor),
    confirmedPickups: history.filter((p) => p.reason === "request_confirmed").length,
    rescuedReports: history.filter((p) => p.reason === "report_rescued").length,
    history,
  };
}

/** Distributed to beneficiaries = beneficiary-confirmed units only (Figma D6 "ما يُحتسب في الأثر"). */
export function distributedKg(data: DemoDataset, listing?: FoodListing): number {
  return data.requests
    .filter((r) => (!listing || r.listingId === listing.id) && (r.status === "completed" || r.status === "partial"))
    .reduce((sum, r) => {
      const l = data.listings.find((x) => x.id === r.listingId);
      return sum + (r.confirmation?.receivedUnits ?? 0) * (l?.unitKg ?? 0);
    }, 0);
}
