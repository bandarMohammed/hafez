import { describe, expect, it } from "vitest";
import { createSeed } from "@/data/seed";
import { can } from "@/domain/permissions";
import { ROLE_CONFIG } from "@/domain/roles";
import type { DemoUser, HallEvent, Role } from "@/domain/types";

const data = createSeed();
const userOf = (role: Role): DemoUser => {
  const u = data.users.find((x) => x.role === role);
  if (!u) throw new Error(`no seed user for ${role}`);
  return u;
};
const event = (id: string): HallEvent => {
  const e = data.events.find((x) => x.id === id);
  if (!e) throw new Error(`no seed event ${id}`);
  return e;
};

describe("can(): workspace.enter", () => {
  it("lets each role enter only its own workspace", () => {
    for (const cfg of ROLE_CONFIG) {
      const user = userOf(cfg.role);
      for (const other of ROLE_CONFIG) {
        expect(can(user, "workspace.enter", { kind: "workspace", workspace: other.workspace })).toBe(
          other.role === cfg.role,
        );
      }
    }
  });

  it("denies everything without a user", () => {
    expect(can(null, "workspace.enter", { kind: "workspace", workspace: "hall" })).toBe(false);
    expect(can(undefined, "event.create")).toBe(false);
  });
});

describe("can(): hall manager scope", () => {
  const hall = userOf("hall_manager");

  it("sees own hall events only", () => {
    expect(can(hall, "event.view", { kind: "event", event: event("E-104") })).toBe(true);
    expect(can(hall, "event.view", { kind: "event", event: event("E-105") })).toBe(false);
  });

  it("edits only while the status is editable (before a rep is assigned)", () => {
    expect(can(hall, "event.edit", { kind: "event", event: event("E-104") })).toBe(true); // awaiting_charity
    expect(can(hall, "event.edit", { kind: "event", event: event("E-107") })).toBe(true); // registered
    expect(can(hall, "event.edit", { kind: "event", event: event("E-103") })).toBe(false); // not_collectable
    expect(can(hall, "event.edit", { kind: "event", event: { ...event("E-104"), status: "assigned" } })).toBe(false);
  });

  it("cannot edit another hall's event even if the status is editable", () => {
    expect(can(hall, "event.edit", { kind: "event", event: event("E-106") })).toBe(false); // yasmin, available
  });

  it("can create events but cannot reset demo data", () => {
    expect(can(hall, "event.create")).toBe(true);
    expect(can(hall, "demo.reset")).toBe(false);
  });
});

describe("can(): other roles", () => {
  it("charity does not see events that are only registered", () => {
    const charity = userOf("charity_coordinator");
    expect(can(charity, "event.view", { kind: "event", event: event("E-107") })).toBe(false);
    expect(can(charity, "event.view", { kind: "event", event: event("E-104") })).toBe(true);
    expect(can(charity, "event.create")).toBe(false);
  });

  it("beneficiary never lists or sees events", () => {
    const b = userOf("beneficiary");
    expect(can(b, "event.list")).toBe(false);
    expect(can(b, "event.view", { kind: "event", event: event("E-104") })).toBe(false);
  });

  it("judge is read-only", () => {
    const j = userOf("judge_viewer");
    expect(can(j, "event.view", { kind: "event", event: event("E-105") })).toBe(true);
    expect(can(j, "event.edit", { kind: "event", event: event("E-105") })).toBe(false);
    expect(can(j, "event.create")).toBe(false);
  });

  it("only admin can reset demo data", () => {
    expect(can(userOf("admin"), "demo.reset")).toBe(true);
  });
});
