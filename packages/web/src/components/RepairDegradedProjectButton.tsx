"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

export function RepairDegradedProjectButton({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const repair = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? t("projects.repairFailed"));
        return;
      }
      router.refresh();
    } catch {
      setError(t("projects.repairNetworkFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => void repair()}
        disabled={submitting}
        className="rounded-lg border border-[var(--color-accent)] bg-[var(--color-tint-blue)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? t("projects.repairing") : t("projects.repairConfig")}
      </button>
      {error ? <p className="mt-3 text-sm text-[var(--color-status-error)]">{error}</p> : null}
    </div>
  );
}
