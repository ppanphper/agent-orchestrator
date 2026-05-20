"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CodeReviewFinding } from "@aoagents/ao-core";
import { MOBILE_BREAKPOINT, useMediaQuery } from "@/hooks/useMediaQuery";
import type { ProjectInfo } from "@/lib/project-name";
import {
  getReviewBoardColumn,
  REVIEW_BOARD_COLUMNS,
  type DashboardReviewRun,
  type ReviewWorkerOption,
  type ReviewBoardColumn,
} from "@/lib/review-types";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import {
  projectDashboardSessionPath,
  projectDashboardPath,
  projectReviewPath,
  projectSessionHashPath,
  projectSessionPath,
} from "@/lib/routes";
import type { DashboardOrchestratorLink, DashboardSession } from "@/lib/types";
import { ProjectSidebar } from "./ProjectSidebar";
import { ToastProvider, useToast } from "./Toast";
import { SidebarContext } from "./workspace/SidebarContext";

interface ReviewDashboardProps {
  runs: DashboardReviewRun[];
  sidebarSessions?: DashboardSession[];
  orchestrators?: DashboardOrchestratorLink[];
  workerOptions?: ReviewWorkerOption[];
  projectId?: string;
  projectName: string;
  projects: ProjectInfo[];
  dashboardLoadError?: string;
}

const EMPTY_RUNS: DashboardReviewRun[] = [];
const EMPTY_SESSIONS: DashboardSession[] = [];
const EMPTY_ORCHESTRATORS: DashboardOrchestratorLink[] = [];
const EMPTY_WORKERS: ReviewWorkerOption[] = [];

interface ReviewDetailsState {
  run: DashboardReviewRun;
  findings: CodeReviewFinding[];
  loading: boolean;
  error: string | null;
}

const SUPERSEDABLE_REVIEW_STATUSES = new Set([
  "queued",
  "needs_triage",
  "sent_to_agent",
  "waiting_update",
  "clean",
]);

function reviewColumnLabelKey(column: ReviewBoardColumn): TranslationKey {
  return `review.columns.${column}` as TranslationKey;
}

function reviewColumnHintKey(column: ReviewBoardColumn): TranslationKey {
  return `review.columnHints.${column}` as TranslationKey;
}

function formatRelativeTime(
  value: string,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return t("review.justNow");
  if (diffMin < 60) return t("review.minutesAgo", { count: diffMin });
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return t("review.hoursAgo", { count: diffHours });
  return t("review.daysAgo", { count: Math.floor(diffHours / 24) });
}

function formatStatus(
  value: string,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  switch (value) {
    case "queued":
      return t("review.statuses.queued");
    case "preparing":
      return t("review.statuses.preparing");
    case "running":
      return t("review.statuses.running");
    case "needs_triage":
      return t("review.statuses.needsTriage");
    case "sent_to_agent":
      return t("review.statuses.sentToAgent");
    case "waiting_update":
      return t("review.statuses.waitingUpdate");
    case "clean":
      return t("review.statuses.clean");
    case "failed":
      return t("review.statuses.failed");
    case "cancelled":
      return t("review.statuses.cancelled");
    case "outdated":
      return t("review.statuses.outdated");
    default:
      return value.replaceAll("_", " ");
  }
}

function formatFindingStatus(
  value: string,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  switch (value) {
    case "open":
      return t("review.findingStatuses.open");
    case "dismissed":
      return t("review.findingStatuses.dismissed");
    case "sent_to_agent":
      return t("review.findingStatuses.sentToAgent");
    case "resolved":
      return t("review.findingStatuses.resolved");
    default:
      return value.replaceAll("_", " ");
  }
}

function formatSeverity(
  value: string,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  switch (value) {
    case "error":
      return t("review.severities.error");
    case "warning":
      return t("review.severities.warning");
    case "info":
      return t("review.severities.info");
    default:
      return value;
  }
}

function formatReviewSummary(
  summary: string | undefined,
  sessionId: string,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string | undefined {
  if (!summary) return undefined;
  const match = summary.match(/^Review requested from (CLI|dashboard|automation) for (.+)\.$/);
  if (!match) return summary;

  const source = match[1] === "CLI" ? "CLI" : t(`review.sources.${match[1]}` as TranslationKey);
  return t("review.defaultSummary", { source, sessionId: match[2] ?? sessionId });
}

function formatFindingLocation(finding: CodeReviewFinding): string | null {
  if (!finding.filePath) return null;
  if (finding.startLine === undefined) return finding.filePath;
  if (finding.endLine !== undefined && finding.endLine !== finding.startLine) {
    return `${finding.filePath}:${finding.startLine}-${finding.endLine}`;
  }
  return `${finding.filePath}:${finding.startLine}`;
}

function formatFindingCount(
  count: number,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  return t("review.finding", { count, plural: count === 1 ? "" : "s" });
}

function canSendFeedbackToWorker(run: DashboardReviewRun): boolean {
  if (!run.workerHasRuntime) return false;
  if (run.workerActivity === "exited") return false;
  return run.workerRuntimeState !== "missing" && run.workerRuntimeState !== "exited";
}

function getWorkerAvailabilityLabel(
  run: DashboardReviewRun,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  if (!run.workerHasRuntime) return t("review.workerAvailability.noRuntime");
  if (run.workerActivity === "exited") return t("review.workerAvailability.exited");
  if (run.workerRuntimeState === "missing") return t("review.workerAvailability.runtimeMissing");
  if (run.workerRuntimeState === "exited") return t("review.workerAvailability.runtimeExited");
  return run.workerActivity ?? run.workerStatus ?? t("review.workerAvailability.worker");
}

function mergeOrchestrators(
  current: DashboardOrchestratorLink[],
  incoming: DashboardOrchestratorLink[],
): DashboardOrchestratorLink[] {
  const merged = new Map(current.map((orchestrator) => [orchestrator.projectId, orchestrator]));
  for (const orchestrator of incoming) {
    merged.set(orchestrator.projectId, orchestrator);
  }
  return Array.from(merged.values());
}

function markSupersededReviewRuns(
  current: DashboardReviewRun[],
  nextRun: DashboardReviewRun,
): DashboardReviewRun[] {
  if (!nextRun.targetSha) return current;

  return current.map((run) => {
    if (run.linkedSessionId !== nextRun.linkedSessionId) return run;
    if (run.id === nextRun.id) return run;
    if (!run.targetSha || run.targetSha === nextRun.targetSha) return run;
    if (!SUPERSEDABLE_REVIEW_STATUSES.has(run.status)) return run;
    return { ...run, status: "outdated" };
  });
}

function ReviewDashboardInner({
  runs = EMPTY_RUNS,
  sidebarSessions = EMPTY_SESSIONS,
  orchestrators = EMPTY_ORCHESTRATORS,
  workerOptions = EMPTY_WORKERS,
  projectId,
  projectName,
  projects,
  dashboardLoadError,
}: ReviewDashboardProps) {
  const { showToast } = useToast();
  const { t } = useI18n();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [reviewRuns, setReviewRuns] = useState(runs);
  const [activeOrchestrators, setActiveOrchestrators] =
    useState<DashboardOrchestratorLink[]>(orchestrators);
  const [requestingSessionId, setRequestingSessionId] = useState<string | null>(null);
  const [executingRunIds, setExecutingRunIds] = useState<Set<string>>(() => new Set());
  const [sendingRunIds, setSendingRunIds] = useState<Set<string>>(() => new Set());
  const [restoringOrchestratorId, setRestoringOrchestratorId] = useState<string | null>(null);
  const [newReviewMenuOpen, setNewReviewMenuOpen] = useState(false);
  const [reviewDetails, setReviewDetails] = useState<ReviewDetailsState | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);

  useEffect(() => {
    setReviewRuns(runs);
  }, [runs]);

  useEffect(() => {
    setActiveOrchestrators((current) => mergeOrchestrators(current, orchestrators));
  }, [orchestrators]);

  useEffect(() => {
    if (!newReviewMenuOpen) return;
    const handlePointer = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setNewReviewMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNewReviewMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [newReviewMenuOpen]);

  useEffect(() => {
    if (!reviewDetails) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setReviewDetails(null);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [reviewDetails]);

  const grouped = useMemo(() => {
    const columns: Record<ReviewBoardColumn, DashboardReviewRun[]> = {
      queued: [],
      reviewing: [],
      triage: [],
      waiting: [],
      clean: [],
      failed: [],
      outdated: [],
    };
    for (const run of reviewRuns) {
      columns[getReviewBoardColumn(run)].push(run);
    }
    return columns;
  }, [reviewRuns]);

  const allProjectsView = !projectId;
  const openFindingCount = reviewRuns.reduce((sum, run) => sum + run.openFindingCount, 0);
  const activeRunCount = reviewRuns.filter((run) =>
    ["queued", "preparing", "running", "needs_triage", "sent_to_agent", "waiting_update"].includes(
      run.status,
    ),
  ).length;
  const currentProjectOrchestrator = projectId
    ? (activeOrchestrators.find((orchestrator) => orchestrator.projectId === projectId) ?? null)
    : null;
  const orchestratorHref = currentProjectOrchestrator
    ? projectSessionPath(currentProjectOrchestrator.projectId, currentProjectOrchestrator.id)
    : null;
  const visibleWorkerOptions = projectId
    ? workerOptions.filter((worker) => worker.projectId === projectId)
    : workerOptions;
  const codingHref = projectId ? projectDashboardPath(projectId) : "/?project=all";
  const reviewHref = projectReviewPath(projectId);
  const localizedProjectName = allProjectsView ? t("review.allProjects") : projectName;
  const headerProjectLabel = localizedProjectName ?? t("review.title");

  const handleToggleSidebar = () => {
    if (isMobile) {
      setMobileMenuOpen((current) => !current);
    } else {
      setSidebarCollapsed((current) => !current);
    }
  };

  const handleRequestReview = async (worker: ReviewWorkerOption) => {
    if (requestingSessionId) return;
    setRequestingSessionId(worker.id);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: worker.id }),
      });
      const data = (await response.json().catch(() => null)) as {
        run?: DashboardReviewRun;
        error?: string;
      } | null;
      if (!response.ok || !data?.run) {
        throw new Error(data?.error ?? t("review.requestFailed"));
      }

      const nextRun: DashboardReviewRun = {
        ...data.run,
        projectName: worker.projectName,
        workerTitle: worker.title,
        workerBranch: worker.branch,
        workerPrUrl: worker.prUrl ?? data.run.prUrl ?? null,
        workerStatus: worker.status,
        workerActivity: worker.activity,
        workerRuntimeState: worker.runtimeState,
        workerHasRuntime: worker.hasRuntime,
      };
      setReviewRuns((current) => [
        nextRun,
        ...markSupersededReviewRuns(
          current.filter((run) => run.id !== nextRun.id),
          nextRun,
        ),
      ]);
      setNewReviewMenuOpen(false);
      showToast(t("review.reviewRunRequested"), "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("review.requestFailed");
      showToast(t("review.reviewFailed", { message }), "error");
    } finally {
      setRequestingSessionId(null);
    }
  };

  const handleExecuteRun = async (run: DashboardReviewRun) => {
    if (executingRunIds.has(run.id)) return;
    setExecutingRunIds((current) => {
      const next = new Set(current);
      next.add(run.id);
      return next;
    });
    setReviewRuns((current) =>
      current.map((entry) => (entry.id === run.id ? { ...entry, status: "running" } : entry)),
    );
    try {
      const response = await fetch("/api/reviews/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: run.projectId,
          runId: run.id,
          force: run.status === "failed",
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        run?: DashboardReviewRun;
        error?: string;
      } | null;
      if (!response.ok || !data?.run) {
        throw new Error(data?.error ?? t("review.executeFailed"));
      }

      setReviewRuns((current) =>
        current.map((entry) =>
          entry.id === run.id
            ? {
                ...entry,
                ...data.run,
                projectName: entry.projectName,
                workerTitle: entry.workerTitle,
                workerBranch: entry.workerBranch,
                workerPrUrl: entry.workerPrUrl,
                workerStatus: entry.workerStatus,
                workerActivity: entry.workerActivity,
                workerRuntimeState: entry.workerRuntimeState,
                workerHasRuntime: entry.workerHasRuntime,
              }
            : entry,
        ),
      );
      if (data.run.status === "failed") {
        showToast(
          t("review.reviewFailed", {
            message: data.run.terminationReason ?? t("review.reviewerExecutionFailed"),
          }),
          "error",
        );
        return;
      }
      showToast(
        data.run.openFindingCount > 0 ? t("review.findingsReady") : t("review.completedClean"),
        "success",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : t("review.executeFailed");
      setReviewRuns((current) =>
        current.map((entry) => (entry.id === run.id ? { ...entry, status: "failed" } : entry)),
      );
      showToast(t("review.reviewFailed", { message }), "error");
    } finally {
      setExecutingRunIds((current) => {
        const next = new Set(current);
        next.delete(run.id);
        return next;
      });
    }
  };

  const mergeRunUpdate = (run: DashboardReviewRun, nextRun: DashboardReviewRun) => ({
    ...run,
    ...nextRun,
    projectName: run.projectName,
    workerTitle: run.workerTitle,
    workerBranch: run.workerBranch,
    workerPrUrl: run.workerPrUrl,
    workerStatus: run.workerStatus,
    workerActivity: run.workerActivity,
    workerRuntimeState: run.workerRuntimeState,
    workerHasRuntime: run.workerHasRuntime,
  });

  const handleSendFeedback = async (run: DashboardReviewRun) => {
    if (sendingRunIds.has(run.id) || run.openFindingCount === 0) return;
    setSendingRunIds((current) => {
      const next = new Set(current);
      next.add(run.id);
      return next;
    });
    try {
      const response = await fetch("/api/reviews/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: run.projectId, runId: run.id }),
      });
      const data = (await response.json().catch(() => null)) as {
        run?: DashboardReviewRun;
        sentFindingCount?: number;
        error?: string;
      } | null;
      if (!response.ok || !data?.run) {
        throw new Error(data?.error ?? t("review.sendFailed"));
      }

      setReviewRuns((current) =>
        current.map((entry) =>
          entry.id === run.id ? mergeRunUpdate(entry, data.run as DashboardReviewRun) : entry,
        ),
      );
      setReviewDetails((current) => {
        if (!current || current.run.id !== run.id) return current;
        const sentAt = new Date().toISOString();
        return {
          ...current,
          run: mergeRunUpdate(current.run, data.run as DashboardReviewRun),
          findings: current.findings.map((finding) =>
            finding.status === "open"
              ? { ...finding, status: "sent_to_agent", sentToAgentAt: sentAt }
              : finding,
          ),
        };
      });
      showToast(
        t("review.sentFindingsTo", {
          count: data.sentFindingCount ?? 0,
          plural: (data.sentFindingCount ?? 0) === 1 ? "" : "s",
          sessionId: run.linkedSessionId,
        }),
        "success",
      );
      router.push(
        projectSessionHashPath(run.projectId, run.linkedSessionId, "#session-terminal-section"),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : t("review.sendFailed");
      showToast(t("review.feedbackFailed", { message }), "error");
    } finally {
      setSendingRunIds((current) => {
        const next = new Set(current);
        next.delete(run.id);
        return next;
      });
    }
  };

  const handleRestoreOrchestrator = async (orchestrator: DashboardOrchestratorLink) => {
    if (restoringOrchestratorId) return;
    setRestoringOrchestratorId(orchestrator.id);
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(orchestrator.id)}/restore`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        session?: DashboardSession;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? t("review.restoreFailed"));
      }

      setActiveOrchestrators((current) =>
        current.map((entry) =>
          entry.id === orchestrator.id
            ? {
                ...entry,
                status: data?.session?.status ?? entry.status,
                activity: data?.session?.activity ?? entry.activity,
                runtimeState: data?.session?.lifecycle?.runtimeState ?? "alive",
                hasRuntime: true,
                isTerminal: false,
                isRestorable: false,
              }
            : entry,
        ),
      );
      showToast(t("review.orchestratorRestored"), "success");
      router.push(projectSessionPath(orchestrator.projectId, orchestrator.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("review.restoreFailed");
      showToast(t("review.restoreFailedToast", { message }), "error");
    } finally {
      setRestoringOrchestratorId(null);
    }
  };

  const handleOpenReviewDetails = async (run: DashboardReviewRun) => {
    setReviewDetails({ run, findings: [], loading: true, error: null });
    try {
      const params = new URLSearchParams({ projectId: run.projectId, runId: run.id });
      const response = await fetch(`/api/reviews/findings?${params.toString()}`);
      const data = (await response.json().catch(() => null)) as {
        findings?: CodeReviewFinding[];
        error?: string;
      } | null;
      if (!response.ok || !data?.findings) {
        throw new Error(data?.error ?? t("review.loadFindingsFailed"));
      }

      setReviewDetails((current) =>
        current?.run.id === run.id
          ? { ...current, findings: data.findings ?? [], loading: false, error: null }
          : current,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : t("review.loadFindingsFailed");
      setReviewDetails((current) =>
        current?.run.id === run.id
          ? { ...current, findings: [], loading: false, error: message }
          : current,
      );
    }
  };

  return (
    <SidebarContext.Provider
      value={{ onToggleSidebar: handleToggleSidebar, mobileSidebarOpen: mobileMenuOpen }}
    >
      <div className="dashboard-app-shell">
        <header className="dashboard-app-header">
          <button
            type="button"
            className="dashboard-app-sidebar-toggle"
            onClick={handleToggleSidebar}
            aria-label={t("review.toggleSidebar")}
          >
            {isMobile ? (
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
              </svg>
            )}
          </button>
          <div className="dashboard-app-header__brand">
            <span className="dashboard-app-header__brand-dot" aria-hidden="true" />
            <span>{t("app.name")}</span>
          </div>
          <span className="dashboard-app-header__sep" aria-hidden="true" />
          <span className="dashboard-app-header__project">{headerProjectLabel}</span>
          <nav className="workspace-mode-switch" aria-label={t("review.workspaceMode")}>
            <Link href={codingHref} className="workspace-mode-switch__item">
              {t("review.coding")}
            </Link>
            <Link
              href={reviewHref}
              className="workspace-mode-switch__item workspace-mode-switch__item--active"
              aria-current="page"
            >
              {t("review.reviews")}
            </Link>
          </nav>
          <div className="dashboard-app-header__spacer" />
          <div className="dashboard-app-header__actions">
            {!allProjectsView && currentProjectOrchestrator && orchestratorHref ? (
              currentProjectOrchestrator.isRestorable ? (
                <button
                  type="button"
                  className="dashboard-app-btn dashboard-app-btn--amber"
                  disabled={restoringOrchestratorId === currentProjectOrchestrator.id}
                  onClick={() => void handleRestoreOrchestrator(currentProjectOrchestrator)}
                >
                  <svg
                    width="12"
                    height="12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M20 11a8 8 0 0 0-14.9-3.98" />
                    <path d="M4 5v4h4" />
                    <path d="M4 13a8 8 0 0 0 14.9 3.98" />
                    <path d="M20 19v-4h-4" />
                  </svg>
                  {restoringOrchestratorId === currentProjectOrchestrator.id
                    ? t("review.restoring")
                    : t("review.restoreOrchestrator")}
                </button>
              ) : (
                <Link
                  href={orchestratorHref}
                  className="dashboard-app-btn dashboard-app-btn--amber"
                  aria-label={t("review.openProjectOrchestrator")}
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
                  {t("dashboard.orchestrator")}
                </Link>
              )
            ) : null}
            <div className="review-new-menu" ref={menuRef}>
              <button
                type="button"
                className="dashboard-app-btn"
                aria-haspopup="menu"
                aria-expanded={newReviewMenuOpen}
                disabled={visibleWorkerOptions.length === 0}
                onClick={() => setNewReviewMenuOpen((open) => !open)}
              >
                <svg
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {t("review.newReview")}
              </button>
              {newReviewMenuOpen ? (
                <div className="review-new-menu__popover" role="menu">
                  {visibleWorkerOptions.map((worker) => (
                    <button
                      key={worker.id}
                      type="button"
                      role="menuitem"
                      className="review-new-menu__item"
                      disabled={requestingSessionId !== null}
                      onClick={() => void handleRequestReview(worker)}
                    >
                      <span className="review-new-menu__item-title">{worker.title}</span>
                      <span className="review-new-menu__item-meta">
                        {allProjectsView ? `${worker.projectName} · ` : ""}
                        {worker.id}
                        {worker.branch ? ` · ${worker.branch}` : ""}
                        {worker.prNumber ? ` · PR #${worker.prNumber}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div
          className={`dashboard-shell dashboard-shell--desktop${
            sidebarCollapsed ? " dashboard-shell--sidebar-collapsed" : ""
          }`}
        >
          <div
            className={`sidebar-wrapper${mobileMenuOpen ? " sidebar-wrapper--mobile-open" : ""}`}
          >
            <ProjectSidebar
              projects={projects}
              sessions={sidebarSessions}
              orchestrators={activeOrchestrators}
              activeProjectId={projectId}
              activeSessionId={undefined}
              collapsed={sidebarCollapsed}
              onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
              onMobileClose={() => setMobileMenuOpen(false)}
            />
          </div>
          {mobileMenuOpen ? (
            <div className="sidebar-mobile-backdrop" onClick={() => setMobileMenuOpen(false)} />
          ) : null}

          <main className="dashboard-main dashboard-main--desktop review-dashboard-main">
            <div className="review-main-header">
              <div>
                <h1 className="dashboard-main__title">
                  {localizedProjectName
                    ? t("review.titleForProject", { project: localizedProjectName })
                    : t("review.title")}
                </h1>
                <p className="dashboard-main__subtitle">
                  {allProjectsView ? t("review.subtitleAll") : t("review.subtitleProject")}
                </p>
              </div>
              <div className="dashboard-stat-cards dashboard-stat-cards--persist-mobile">
                <ReviewMetric
                  label={t("review.runs")}
                  value={reviewRuns.length}
                  meta={t("review.totalReviewRuns")}
                />
                <ReviewMetric
                  label={t("review.active")}
                  value={activeRunCount}
                  meta={t("review.openReviewLoops")}
                />
                <ReviewMetric
                  label={t("review.findings")}
                  value={openFindingCount}
                  meta={t("review.openAoFindings")}
                />
              </div>
            </div>

            {dashboardLoadError ? (
              <div className="dashboard-alert mb-4 border border-[color-mix(in_srgb,var(--color-status-error)_28%,transparent)] bg-[color-mix(in_srgb,var(--color-status-error)_10%,transparent)] px-3.5 py-2.5 text-[11px] text-[var(--color-status-error)]">
                {dashboardLoadError}
              </div>
            ) : null}

            {reviewRuns.length === 0 ? (
              <section className="review-empty-state">
                <div className="review-empty-state__title">{t("review.noRunsTitle")}</div>
                <p className="review-empty-state__body">{t("review.noRunsBody")}</p>
                <Link
                  href={projectId ? projectDashboardPath(projectId) : "/?project=all"}
                  className="review-empty-state__link"
                >
                  {t("review.backToCoding")}
                </Link>
              </section>
            ) : (
              <div className="kanban-board-wrap">
                <div
                  className="kanban-board review-kanban-board"
                  data-columns={REVIEW_BOARD_COLUMNS.length}
                  style={
                    {
                      "--kanban-column-count": REVIEW_BOARD_COLUMNS.length,
                    } as React.CSSProperties
                  }
                >
                  {REVIEW_BOARD_COLUMNS.map((column) => (
                    <ReviewColumn
                      key={column}
                      column={column}
                      runs={grouped[column]}
                      allProjectsView={allProjectsView}
                      executingRunIds={executingRunIds}
                      sendingRunIds={sendingRunIds}
                      onOpenDetails={handleOpenReviewDetails}
                      onExecute={handleExecuteRun}
                      onSendFeedback={handleSendFeedback}
                    />
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
        {reviewDetails ? (
          <ReviewDetailsDrawer
            state={reviewDetails}
            onClose={() => setReviewDetails(null)}
            onOpenWorker={() => setReviewDetails(null)}
            isSending={sendingRunIds.has(reviewDetails.run.id)}
            onSendFeedback={handleSendFeedback}
          />
        ) : null}
      </div>
    </SidebarContext.Provider>
  );
}

export function ReviewDashboard(props: ReviewDashboardProps) {
  return (
    <ToastProvider>
      <ReviewDashboardInner {...props} />
    </ToastProvider>
  );
}

function ReviewMetric({ label, value, meta }: { label: string; value: number; meta: string }) {
  return (
    <div className="dashboard-stat-card">
      <span className="dashboard-stat-card__value">{value}</span>
      <span className="dashboard-stat-card__label">{label}</span>
      <span className="dashboard-stat-card__meta">{meta}</span>
    </div>
  );
}

function ReviewColumn({
  column,
  runs,
  allProjectsView,
  executingRunIds,
  sendingRunIds,
  onOpenDetails,
  onExecute,
  onSendFeedback,
}: {
  column: ReviewBoardColumn;
  runs: DashboardReviewRun[];
  allProjectsView: boolean;
  executingRunIds: Set<string>;
  sendingRunIds: Set<string>;
  onOpenDetails: (run: DashboardReviewRun) => void;
  onExecute: (run: DashboardReviewRun) => void;
  onSendFeedback: (run: DashboardReviewRun) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="kanban-column review-kanban-column" data-review-column={column}>
      <div className="kanban-column__header">
        <div className="kanban-column__title-row">
          <div className="kanban-column__dot review-column-dot" data-review-column={column} />
          <span className="kanban-column__title">{t(reviewColumnLabelKey(column))}</span>
          <span className="kanban-column__count">{runs.length}</span>
        </div>
        <p className="review-column-hint">{t(reviewColumnHintKey(column))}</p>
      </div>

      <div className="kanban-column-body">
        {runs.length > 0 ? (
          <div className="kanban-column__stack">
            {runs.map((run) => (
              <ReviewCard
                key={run.id}
                run={run}
                allProjectsView={allProjectsView}
                isExecuting={executingRunIds.has(run.id)}
                isSending={sendingRunIds.has(run.id)}
                onOpenDetails={onOpenDetails}
                onExecute={onExecute}
                onSendFeedback={onSendFeedback}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReviewCard({
  run,
  allProjectsView,
  isExecuting,
  isSending,
  onOpenDetails,
  onExecute,
  onSendFeedback,
}: {
  run: DashboardReviewRun;
  allProjectsView: boolean;
  isExecuting: boolean;
  isSending: boolean;
  onOpenDetails: (run: DashboardReviewRun) => void;
  onExecute: (run: DashboardReviewRun) => void;
  onSendFeedback: (run: DashboardReviewRun) => void;
}) {
  const { t } = useI18n();
  const workerHref = projectDashboardSessionPath(run.projectId, run.linkedSessionId);
  const title = run.workerTitle ?? run.linkedSessionId;
  const status = formatStatus(run.status, t);
  const totalFindingLabel = formatFindingCount(run.findingCount, t);
  const secondaryText =
    formatReviewSummary(run.summary, run.linkedSessionId, t) ??
    (run.status === "clean"
      ? t("review.reviewerCompletedClean")
      : t("review.reviewRequestedFor", { sessionId: run.linkedSessionId }));
  const truthLine = `${status} · ${totalFindingLabel}${
    run.dismissedFindingCount > 0
      ? ` · ${t("review.dismissed", { count: run.dismissedFindingCount })}`
      : ""
  }${run.sentFindingCount > 0 ? ` · ${t("review.sent", { count: run.sentFindingCount })}` : ""} · ${t("review.workerLabel")} ${getWorkerAvailabilityLabel(run, t)}`;
  const canExecute = isExecuting || run.status === "queued" || run.status === "failed";
  const feedbackAvailable = canSendFeedbackToWorker(run);
  const dotClass =
    run.status === "running" || run.status === "preparing"
      ? "card__adot--working"
      : run.status === "clean"
        ? "card__adot--ready"
        : run.status === "needs_triage" || run.status === "failed" || run.status === "cancelled"
          ? "card__adot--waiting"
          : run.status === "sent_to_agent" || run.status === "waiting_update"
            ? "card__adot--ready"
            : "card__adot--idle";

  return (
    <article
      className="session-card session-card--fixed review-card"
      data-review-status={run.status}
      data-reviewer-session-id={run.reviewerSessionId}
      data-linked-session-id={run.linkedSessionId}
    >
      <div className="session-card__header">
        <span className={`card__adot ${dotClass}`} />
        <span className="card__id">
          {allProjectsView ? `${run.projectName} · ` : ""}
          {run.reviewerSessionId}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          className="session-card__control session-card__terminal-link"
          onClick={() => onOpenDetails(run)}
        >
          <svg
            className="session-card__control-icon"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M4 19.5V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-1.5Z" />
            <path d="M8 7h6M8 11h6M8 15h4" />
          </svg>
          {t("review.details")}
        </button>
      </div>

      <div className="session-card__body flex min-h-0 flex-1 flex-col">
        <div className="card__title-wrap">
          <p className="card__title">{title}</p>
        </div>

        <div className="card__meta">
          {run.workerBranch ? <span className="card__branch">{run.workerBranch}</span> : null}
          {run.workerBranch && run.prNumber ? (
            <span className="card__meta-sep" aria-hidden="true">
              ·
            </span>
          ) : null}
          {run.prNumber && run.workerPrUrl ? (
            <a href={run.workerPrUrl} target="_blank" rel="noreferrer" className="card__pr">
              #{run.prNumber}
            </a>
          ) : run.prNumber ? (
            <span className="card__pr">#{run.prNumber}</span>
          ) : null}
        </div>

        <div className="px-[10px] pb-[5px]">
          <p className="session-card__secondary">{secondaryText}</p>
        </div>

        <div className="px-[10px] pb-[5px]">
          <p className="text-[10px] leading-relaxed text-[var(--color-text-tertiary)]">
            {truthLine}
          </p>
        </div>

        {run.openFindingCount > 0 ? (
          <div className="card__alerts">
            <div className="alert-row alert-row--review review-card__finding-alert">
              <span className="alert-row__icon" aria-hidden="true">
                !
              </span>
              <span className="alert-row__text">
                <button type="button" onClick={() => onOpenDetails(run)}>
                  <span className="font-bold">{run.openFindingCount}</span>{" "}
                  {run.openFindingCount === 1 ? t("review.openFinding") : t("review.openFindings")}
                </button>
              </span>
              <button
                type="button"
                className="alert-row__action"
                onClick={() => onOpenDetails(run)}
              >
                {t("review.view")}
              </button>
            </div>
          </div>
        ) : null}

        <div className="session-card__footer">
          <span className="card__status min-w-0 truncate">
            {status} · {t("review.updated")} {formatRelativeTime(run.updatedAt, t)}
          </span>
          <div className="session-card__footer-actions">
            {canExecute ? (
              <button
                type="button"
                className="session-card__control session-card__review-control"
                disabled={isExecuting}
                onClick={() => onExecute(run)}
              >
                <svg
                  className="session-card__control-icon"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M5 3v18l15-9-15-9Z" />
                </svg>
                {isExecuting
                  ? t("review.running")
                  : run.status === "failed"
                    ? t("review.retry")
                    : t("review.run")}
              </button>
            ) : null}
            <Link href={workerHref} className="session-card__control session-card__review-control">
              {t("review.worker")}
            </Link>
            {feedbackAvailable ? (
              <button
                type="button"
                className="session-card__control session-card__terminal-link"
                disabled={isSending || run.openFindingCount === 0}
                title={
                  run.openFindingCount === 0
                    ? t("review.noOpenFindingsToSend")
                    : t("review.sendFindingsToWorker")
                }
                onClick={() => onSendFeedback(run)}
              >
                {isSending ? t("review.sending") : t("review.feedback")}
              </button>
            ) : (
              <span
                className="session-card__control session-card__terminal-link review-card__disabled-control"
                title={t("review.workerFeedbackUnavailableTitle")}
              >
                {getWorkerAvailabilityLabel(run, t)}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function ReviewDetailsDrawer({
  state,
  onClose,
  onOpenWorker,
  isSending,
  onSendFeedback,
}: {
  state: ReviewDetailsState;
  onClose: () => void;
  onOpenWorker: () => void;
  isSending: boolean;
  onSendFeedback: (run: DashboardReviewRun) => void;
}) {
  const { t } = useI18n();
  const { run, findings, loading, error } = state;
  const workerHref = projectDashboardSessionPath(run.projectId, run.linkedSessionId);
  const feedbackHref = projectSessionHashPath(
    run.projectId,
    run.linkedSessionId,
    "#session-terminal-section",
  );
  const openFindings = findings.filter((finding) => finding.status === "open");
  const feedbackAvailable = canSendFeedbackToWorker(run);

  return (
    <>
      <div className="review-detail-backdrop" onClick={onClose} />
      <aside
        className="review-detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-detail-title"
      >
        <div className="review-detail-panel__header">
          <div>
            <div className="review-detail-panel__eyebrow">{run.reviewerSessionId}</div>
            <h2 id="review-detail-title" className="review-detail-panel__title">
              {run.workerTitle ?? run.linkedSessionId}
            </h2>
          </div>
          <button
            type="button"
            className="review-detail-panel__close"
            onClick={onClose}
            aria-label={t("review.closeDetails")}
          >
            x
          </button>
        </div>

        <div className="review-detail-panel__meta">
          <span>{formatStatus(run.status, t)}</span>
          <span>{run.linkedSessionId}</span>
          {run.workerBranch ? <span>{run.workerBranch}</span> : null}
          {run.prNumber ? <span>PR #{run.prNumber}</span> : null}
        </div>

        <div className="review-detail-panel__actions">
          <Link href={workerHref} onClick={onOpenWorker}>
            {t("review.openWorker")}
          </Link>
          {run.workerPrUrl ? (
            <a href={run.workerPrUrl} target="_blank" rel="noreferrer">
              {t("review.openPr")}
            </a>
          ) : null}
          {feedbackAvailable ? <Link href={feedbackHref}>{t("review.openTerminal")}</Link> : null}
          {feedbackAvailable && openFindings.length > 0 ? (
            <button type="button" disabled={isSending} onClick={() => onSendFeedback(run)}>
              {isSending ? t("review.sendingFeedback") : t("review.sendFeedback")}
            </button>
          ) : null}
        </div>

        {!feedbackAvailable ? (
          <div className="review-detail-panel__notice">
            {t("review.feedbackUnavailable", { state: getWorkerAvailabilityLabel(run, t) })}
          </div>
        ) : null}

        <div className="review-detail-panel__summary">
          <div className="review-detail-panel__summary-item">
            <span>{t("review.open")}</span>
            <strong>{openFindings.length || run.openFindingCount}</strong>
          </div>
          <div className="review-detail-panel__summary-item">
            <span>{t("review.total")}</span>
            <strong>{run.findingCount}</strong>
          </div>
          <div className="review-detail-panel__summary-item">
            <span>{t("review.updated")}</span>
            <strong>{formatRelativeTime(run.updatedAt, t)}</strong>
          </div>
        </div>

        <div className="review-detail-panel__content">
          {loading ? (
            <div className="review-detail-panel__empty">{t("review.loadingFindings")}</div>
          ) : null}
          {error ? <div className="review-detail-panel__error">{error}</div> : null}
          {!loading && !error && findings.length === 0 ? (
            <div className="review-detail-panel__empty">{t("review.noFindings")}</div>
          ) : null}
          {!loading && !error
            ? findings.map((finding) => {
                const location = formatFindingLocation(finding);
                return (
                  <article
                    key={finding.id}
                    className="review-detail-finding"
                    data-severity={finding.severity}
                  >
                    <div className="review-detail-finding__header">
                      <span>{formatSeverity(finding.severity, t)}</span>
                      <span>{formatFindingStatus(finding.status, t)}</span>
                    </div>
                    <h3>{finding.title}</h3>
                    {location ? <code>{location}</code> : null}
                    <p>{finding.body}</p>
                  </article>
                );
              })
            : null}
        </div>
      </aside>
    </>
  );
}
