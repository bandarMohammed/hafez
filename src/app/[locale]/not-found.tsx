import { getTranslations } from "next-intl/server";
import { DemoBar } from "@/components/layout/DemoBar";
import { ButtonLink } from "@/components/ui/Button";
import { StateMessage } from "@/components/ui/StateMessage";

export default async function NotFound() {
  const t = await getTranslations("states.notFound");
  return (
    <>
      <DemoBar />
      <main id="main">
        <StateMessage
          asPage
          icon="alert"
          title={t("title")}
          body={t("body")}
          actions={<ButtonLink href="/">{t("action")}</ButtonLink>}
        />
      </main>
    </>
  );
}
