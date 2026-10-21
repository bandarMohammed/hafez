import type { ReactNode } from "react";
import { DemoBar } from "@/components/layout/DemoBar";
import { WorkspaceGate } from "@/components/layout/WorkspaceGate";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { getRoleConfig } from "@/domain/roles";

/** Hall-manager workspace: demo bar always visible (so the role can be switched), then gate → shell. */
export default function HallLayout({ children }: { children: ReactNode }) {
  const { nav, workspace } = getRoleConfig("hall_manager");
  return (
    <>
      <DemoBar />
      <WorkspaceGate workspace={workspace}>
        <WorkspaceShell nav={nav} labelNamespace="hall.nav">
          {children}
        </WorkspaceShell>
      </WorkspaceGate>
    </>
  );
}
