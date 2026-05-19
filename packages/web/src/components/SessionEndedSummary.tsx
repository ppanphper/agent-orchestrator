"use client";

import type { DashboardPR, DashboardSession } from "@/lib/types";
import { formatRelativeTime } from "@/lib/format";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface SessionEndedSummaryProps {
  session: DashboardSession;
  headline: string;
  pr: DashboardPR | null;
  dashboardHref: string;
  isRestorable: boolean;
  onRestore: () => void;
}

function formatEndedTime(
  isoDate: string | null | undefined,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  if (!isoDate) return t("session.unknown");
  const timestamp = new Date(isoDate).getTime();
  if (!Number.isFinite(timestamp)) return t("session.unknown");
  return formatRelativeTime(timestamp);
}

function getEndedSessionReason(
  session: DashboardSession,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  if (session.lifecycle?.runtime.reasonLabel) {
    return session.lifecycle.runtime.reasonLabel;
  }
  if (session.status === "killed") return t("session.manuallyStopped");
  if (session.status === "terminated") return t("session.runtimeUnavailable");
  if (session.status === "done" || session.status === "merged") return t("session.workCompleted");
  return t("session.terminalEnded");
}

function getEndedSessionSummary(session: DashboardSession, headline: string): string {
  const pinnedSummary = session.metadata["pinnedSummary"];
  if (pinnedSummary) return pinnedSummary;
  if (session.summary && !session.summaryIsFallback) return session.summary;
  if (session.lifecycle?.summary) return session.lifecycle.summary;
  if (session.userPrompt) return session.userPrompt;
  if (session.summary) return session.summary;
  return headline;
}

export function SessionEndedSummary({
  session,
  headline,
  pr,
  dashboardHref,
  isRestorable,
  onRestore,
}: SessionEndedSummaryProps) {
  const { t } = useI18n();
  const reason = getEndedSessionReason(session, t);
  const summary = getEndedSessionSummary(session, headline);
  const endedAt =
    session.lifecycle?.session.terminatedAt ??
    session.lifecycle?.session.completedAt ??
    session.lifecycle?.session.lastTransitionAt ??
    session.lastActivityAt;
  const runtimeLabel = session.lifecycle?.runtime.label ?? t("session.unavailable");
  const prLabel = pr
    ? pr.state === "merged"
      ? t("session.merged")
      : pr.state === "closed"
        ? t("session.closed")
        : pr.mergeability.mergeable
          ? t("session.openMergeReady")
          : t("session.open")
    : t("session.noPrShort");

  return (
    <section className="session-ended-summary" aria-label={t("session.terminalEndedSummary")}>
      <div className="session-ended-summary__panel">
        <div className="session-ended-summary__eyebrow">{t("session.terminalEnded")}</div>
        <div className="session-ended-summary__header">
          <div className="session-ended-summary__icon" aria-hidden="true">
            <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <path d="M7 10l3 2-3 2" />
              <path d="M13 15h4" />
            </svg>
          </div>
          <div className="session-ended-summary__title-group">
            <h2 className="session-ended-summary__title">{headline}</h2>
            <p className="session-ended-summary__subtitle">
              {t("session.terminalEndedContext", { reason })}
            </p>
          </div>
        </div>

        <div className="session-ended-summary__body">
          <div className="session-ended-summary__section">
            <div className="session-ended-summary__label">{t("session.whatHappened")}</div>
            <p className="session-ended-summary__copy">{summary}</p>
          </div>

          <div className="session-ended-summary__facts" aria-label={t("session.sessionFacts")}>
            <div className="session-ended-summary__fact">
              <span>{t("session.sessionFact")}</span>
              <strong>{session.id}</strong>
            </div>
            <div className="session-ended-summary__fact">
              <span>{t("session.ended")}</span>
              <strong>{formatEndedTime(endedAt, t)}</strong>
            </div>
            <div className="session-ended-summary__fact">
              <span>{t("session.runtime")}</span>
              <strong>{runtimeLabel}</strong>
            </div>
            <div className="session-ended-summary__fact">
              <span>{t("session.pr")}</span>
              <strong>{prLabel}</strong>
            </div>
          </div>

          <div className="session-ended-summary__links">
            {isRestorable ? (
              <button
                type="button"
                onClick={onRestore}
                className="session-ended-summary__primary"
              >
                Restore session
              </button>
            ) : null}
            {pr ? (
              <a
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  isRestorable
                    ? "session-ended-summary__secondary"
                    : "session-ended-summary__primary"
                }
              >
                {t("session.openPr", { number: pr.number })}
              </a>
            ) : null}
            <a href={dashboardHref} className="session-ended-summary__secondary">
              {t("common.backToDashboard")}
            </a>
          </div>

          {session.lifecycle?.evidence ? (
            <div className="session-ended-summary__evidence">
              <span>{t("session.evidence")}</span>
              <code>{session.lifecycle.evidence}</code>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
