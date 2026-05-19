"use client";

import { useEffect } from "react";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { I18nProvider, useI18n } from "@/lib/i18n";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="zh-CN" className="dark">
      <body className="bg-[var(--color-bg-base)] text-[var(--color-text-primary)] antialiased">
        <I18nProvider locale="zh-CN">
          <GlobalErrorContent error={error} reset={reset} />
        </I18nProvider>
      </body>
    </html>
  );
}

function GlobalErrorContent({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  return (
    <ErrorDisplay
      title={t("errors.globalTitle")}
      message={t("errors.globalMessage")}
      tone="error"
      primaryAction={{ label: t("common.retry"), onClick: reset }}
      secondaryAction={{ label: t("errors.reloadPage"), onClick: () => window.location.reload() }}
      error={error}
    />
  );
}
