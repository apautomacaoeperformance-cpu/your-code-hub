import { useTranslation } from "react-i18next";
export default function Cessionaria() {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{t("pages.cessionaria")}</h1>
      <p className="text-sm text-muted-foreground">{t("common.comingSoon")}</p>
    </div>
  );
}
