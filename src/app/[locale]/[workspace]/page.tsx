import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DemoBar } from "@/components/layout/DemoBar";
import { WorkspaceGate } from "@/components/layout/WorkspaceGate";
import { getRoleByWorkspace } from "@/domain/roles";
import { RoleComingSoon } from "@/features/common/ComingSoon";

/**
 * Home of roles not implemented in this iteration (admin, charity, field, judge, beneficiary).
 * Same gate as real workspaces, then an explicit "under development" state — never a fake dashboard.
 */
export default async function RoleWorkspacePage({
  params,
}: {
  params: Promise<{ locale: string; workspace: string }>;
}) {
  const { locale, workspace } = await params;
  setRequestLocale(locale);
  const config = getRoleByWorkspace(workspace);
  if (!config || config.implemented) notFound();
  const t = await getTranslations({ locale, namespace: "roles" });

  return (
    <>
      <DemoBar />
      <WorkspaceGate workspace={workspace}>
        <main id="main">
          <RoleComingSoon roleName={t(`${config.role}.name`)} frame={config.homeFrame} />
        </main>
      </WorkspaceGate>
    </>
  );
}
