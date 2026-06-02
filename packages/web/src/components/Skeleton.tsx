"use client";

// ── State UI ──────────────────────────────────────────────────────────

import { useI18n } from "@/lib/i18n";

interface EmptyStateProps {
  message?: string;
  orchestratorHref?: string | null;
  onSpawnOrchestrator?: (() => void) | null;
  spawnLabel?: string;
  spawnDisabled?: boolean;
}

export function EmptyState({
  message,
  orchestratorHref,
  onSpawnOrchestrator = null,
  spawnLabel = "Spawn Orchestrator",
  spawnDisabled = false,
}: EmptyStateProps) {
  const { t } = useI18n();
  const ghostColumns = [
    t("emptyState.ghost.working"),
    t("emptyState.ghost.pending"),
    t("emptyState.ghost.review"),
    t("emptyState.ghost.respond"),
    t("emptyState.ghost.merge"),
  ] as const;

  return (
    <div className="board-wrapper">
      <div className="kanban-ghost" aria-hidden="true">
        {ghostColumns.map((label) => (
          <div key={label} className="kanban-ghost__col">
            <div className="kanban-ghost__head">{label}</div>
          </div>
        ))}
      </div>

      <div className="board-center">
        <div className="empty-state" role="status">
          <div className="empty-state__icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle
                cx="12"
                cy="5.5"
                r="2.5"
                fill="color-mix(in srgb, var(--color-accent) 18%, transparent)"
                stroke="var(--color-accent)"
                strokeWidth="1.5"
              />
              <circle
                cx="5.5"
                cy="17"
                r="2.5"
                fill="var(--color-bg-subtle)"
                stroke="var(--color-border-strong)"
                strokeWidth="1.5"
              />
              <circle
                cx="18.5"
                cy="17"
                r="2.5"
                fill="var(--color-bg-subtle)"
                stroke="var(--color-border-strong)"
                strokeWidth="1.5"
              />
              <line
                x1="12"
                y1="8"
                x2="6.7"
                y2="14.8"
                stroke="color-mix(in srgb, var(--color-accent) 22%, transparent)"
                strokeWidth="1"
                strokeDasharray="2.5 2"
              />
              <line
                x1="12"
                y1="8"
                x2="17.3"
                y2="14.8"
                stroke="color-mix(in srgb, var(--color-accent) 22%, transparent)"
                strokeWidth="1"
                strokeDasharray="2.5 2"
              />
              <line
                x1="7.8"
                y1="17"
                x2="16.2"
                y2="17"
                stroke="var(--color-border-subtle)"
                strokeWidth="1"
                strokeDasharray="2.5 2"
              />
            </svg>
          </div>
          {message ? (
            <p className="empty-state__text">{message}</p>
          ) : (
            <>
              <p className="empty-state__headline">{t("emptyState.headline")}</p>
              <p className="empty-state__hint">{t("emptyState.hint")}</p>
              {orchestratorHref ? (
                <a href={orchestratorHref} className="empty-state__cta">
                  <svg
                    width="12"
                    height="12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="5" r="2" fill="currentColor" stroke="none" />
                    <path d="M12 7v4M12 11H6M12 11h6M6 11v3M12 11v3M18 11v3" />
                    <circle cx="6" cy="17" r="2" />
                    <circle cx="12" cy="17" r="2" />
                    <circle cx="18" cy="17" r="2" />
                  </svg>
                  {t("emptyState.openOrchestrator")}
                </a>
              ) : onSpawnOrchestrator ? (
                <button
                  type="button"
                  className="empty-state__cta"
                  onClick={onSpawnOrchestrator}
                  disabled={spawnDisabled}
                >
                  <svg
                    width="12"
                    height="12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="5" r="2" fill="currentColor" stroke="none" />
                    <path d="M12 7v4M12 11H6M12 11h6M6 11v3M12 11v3M18 11v3" />
                    <circle cx="6" cy="17" r="2" />
                    <circle cx="12" cy="17" r="2" />
                    <circle cx="18" cy="17" r="2" />
                  </svg>
                  {spawnLabel}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
