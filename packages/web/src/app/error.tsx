"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { useI18n } from "@/lib/i18n";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorDisplay
      title={t("errors.routeTitle")}
      message={t("errors.routeMessage")}
      tone="warning"
      primaryAction={{
        label: t("common.retry"),
        onClick: () => {
          reset();
          router.refresh();
        },
      }}
      secondaryAction={{ label: t("common.backToDashboard"), href: "/" }}
      error={error}
      compact
      chrome="card"
    />
  );
}
