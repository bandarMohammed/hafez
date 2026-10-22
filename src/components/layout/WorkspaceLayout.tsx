import type { ReactNode } from "react";
import { getRoleConfig } from "@/domain/roles";
import type { Role } from "@/domain/types";
import { DemoBar } from "./DemoBar";
import { WorkspaceGate } from "./WorkspaceGate";
import { WorkspaceShell } from "./WorkspaceShell";
import { JourneyReturn } from "@/features/journey/JourneyReturn";

/** Every role workspace: demo bar always visible (so the role can be switched), then gate → shell. */
export function WorkspaceLayout({ role, children }: { role: Role; children: ReactNode }) {
  return (
    <>
      <DemoBar />
      {/* Shown only when this screen was opened from the pitch journey page. */}
      <JourneyReturn />
      <WorkspaceGate workspace={getRoleConfig(role).workspace}>
        <WorkspaceShell role={role}>{children}</WorkspaceShell>
      </WorkspaceGate>
    </>
  );
}
