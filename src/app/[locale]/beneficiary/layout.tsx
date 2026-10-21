import type { ReactNode } from "react";
import { WorkspaceLayout } from "@/components/layout/WorkspaceLayout";

export default function Layout({ children }: { children: ReactNode }) {
  return <WorkspaceLayout role="beneficiary">{children}</WorkspaceLayout>;
}
