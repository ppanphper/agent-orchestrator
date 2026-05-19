"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { useI18n, type TranslationKey } from "@/lib/i18n";

function getSessionErrorMessage(
  error: Error,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  const normalized = error.message.toLowerCase();
  if (normalized.includes("timed out")) return t("session.loadTimeout");
  if (normalized.includes("network")) return t("session.loadNetwork");
  if (normalized.includes("403")) return t("session.loadForbidden");
  if (normalized.includes("404")) return t("session.loadMissing");
  if (normalized.includes("500")) return t("session.loadServer");
  if (error.message.trim().length > 0) {
    return error.message;
  }
  return t("session.loadGeneric");
}

export default function SessionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorDisplay
      title={t("session.loadFailedTitle")}
      message={getSessionErrorMessage(error, t)}
      tone="error"
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
