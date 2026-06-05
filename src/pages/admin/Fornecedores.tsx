import { useTranslation } from "react-i18next";
export default function Fornecedores() {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{t("pages.fornecedores")}</h1>
      <p className="text-sm text-muted-foreground">{t("common.comingSoon")}</p>
    </div>
  );
}
