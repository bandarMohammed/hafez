import { setRequestLocale } from "next-intl/server";
import { FieldTasksScreen } from "@/features/field/FieldTasks";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <FieldTasksScreen />;
}
