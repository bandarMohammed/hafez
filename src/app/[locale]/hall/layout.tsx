import type { ReactNode } from "react";
import { WorkspaceLayout } from "@/components/layout/WorkspaceLayout";

export default function HallLayout({ children }: { children: ReactNode }) {
  return <WorkspaceLayout role="hall_manager">{children}</WorkspaceLayout>;
}
