"use client";

import { ErrorDisplay } from "@/components/ErrorDisplay";
import { useI18n } from "@/lib/i18n";

export default function SessionNotFound() {
  const { t } = useI18n();
  return (
    <ErrorDisplay
      title={t("session.notFoundTitle")}
      message={t("session.notFoundStale")}
      tone="not-found"
      primaryAction={{ label: t("common.backToDashboard"), href: "/" }}
      compact
      chrome="card"
    />
  );
}
