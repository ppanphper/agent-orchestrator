"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface BacklogIssue {
  projectId: string;
  id: string;
  title: string;
  url?: string;
  labels?: string[];
}

interface BacklogResponse {
  issues?: BacklogIssue[];
  poller?: {
    running: boolean;
    paused: boolean;
    maxConcurrent: number;
  };
  error?: string;
}

interface LabelSetupResponse {
  results?: Array<{ status: "created" | "exists" | "failed" }>;
  error?: string;
}

interface BacklogPanelProps {
  projectId: string;
}

export function BacklogPanel({ projectId }: BacklogPanelProps) {
  const [issues, setIssues] = useState<BacklogIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [savingMaxConcurrent, setSavingMaxConcurrent] = useState(false);
  const [spawningIssueId, setSpawningIssueId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setupSummary, setSetupSummary] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [pollerPaused, setPollerPaused] = useState(false);
  const [maxConcurrent, setMaxConcurrent] = useState(5);

  const projectIssues = useMemo(
    () => issues.filter((issue) => issue.projectId === projectId),
    [issues, projectId],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/backlog", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as BacklogResponse | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Backlog request failed with ${response.status}`);
      }
      setIssues(data?.issues ?? []);
      setPollerPaused(data?.poller?.paused === true);
      setMaxConcurrent(data?.poller?.maxConcurrent ?? 5);
      setLastRefreshedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load backlog");
    } finally {
      setLoading(false);
    }
  }, []);

  const setPoller = useCallback(
    async (action: "start" | "stop") => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/backlog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = (await response.json().catch(() => null)) as BacklogResponse | null;
        if (!response.ok) {
          throw new Error(data?.error ?? `Backlog ${action} failed with ${response.status}`);
        }
        setPollerPaused(data?.poller?.paused === true);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to ${action} backlog poller`);
      } finally {
        setLoading(false);
      }
    },
    [refresh],
  );

  const claimNow = useCallback(async () => {
    setClaiming(true);
    setError(null);
    try {
      const response = await fetch("/api/backlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim-now" }),
      });
      const data = (await response.json().catch(() => null)) as BacklogResponse | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Claim failed with ${response.status}`);
      }
      setIssues(data?.issues ?? []);
      setPollerPaused(data?.poller?.paused === true);
      setMaxConcurrent(data?.poller?.maxConcurrent ?? maxConcurrent);
      setLastRefreshedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim backlog issue");
    } finally {
      setClaiming(false);
    }
  }, [maxConcurrent]);

  const saveMaxConcurrent = useCallback(async (nextMaxConcurrent: number) => {
    const normalized = Math.max(1, Math.min(50, Math.trunc(nextMaxConcurrent)));
    setMaxConcurrent(normalized);
    setSavingMaxConcurrent(true);
    setError(null);
    try {
      const response = await fetch("/api/backlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-max-concurrent", maxConcurrent: normalized }),
      });
      const data = (await response.json().catch(() => null)) as BacklogResponse | null;
      if (!response.ok) {
        throw new Error(data?.error ?? `Concurrency update failed with ${response.status}`);
      }
      setPollerPaused(data?.poller?.paused === true);
      setMaxConcurrent(data?.poller?.maxConcurrent ?? normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update concurrency limit");
    } finally {
      setSavingMaxConcurrent(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setupLabels = useCallback(async () => {
    setSetupLoading(true);
    setSetupSummary(null);
    setError(null);
    try {
      const response = await fetch("/api/setup-labels", { method: "POST" });
      const data = (await response.json().catch(() => null)) as LabelSetupResponse | null;
      if (!response.ok && response.status !== 207) {
        throw new Error(data?.error ?? `Label setup failed with ${response.status}`);
      }

      const results = data?.results ?? [];
      const failed = results.filter((result) => result.status === "failed").length;
      setSetupSummary(failed > 0 ? `${failed} label update failed` : "Labels ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to setup labels");
    } finally {
      setSetupLoading(false);
    }
  }, []);

  const spawnIssue = useCallback(
    async (issueId: string) => {
      setSpawningIssueId(issueId);
      setError(null);
      try {
        const response = await fetch("/api/spawn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, issueId }),
        });
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) {
          throw new Error(data?.error ?? `Spawn failed with ${response.status}`);
        }
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to start #${issueId}`);
      } finally {
        setSpawningIssueId(null);
      }
    },
    [projectId, refresh],
  );

  return (
    <section className="mb-4 rounded-[8px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-[var(--color-status-success)]" />
            <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Backlog</h2>
            <span className="rounded-full border border-[var(--color-border-subtle)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
              {projectIssues.length}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
            {pollerPaused
              ? "Paused"
              : lastRefreshedAt
                ? `Last refresh ${lastRefreshedAt}`
                : "Ready"}
          </p>
        </div>

        <label className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
          Max
          <input
            type="number"
            min={1}
            max={50}
            value={maxConcurrent}
            onChange={(event) => void saveMaxConcurrent(Number(event.target.value))}
            disabled={savingMaxConcurrent}
            className="h-7 w-14 rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-2 text-[11px] text-[var(--color-text-primary)]"
            aria-label="Max concurrent backlog agents"
          />
        </label>

        <button
          type="button"
          className="dashboard-app-btn"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="Refresh backlog"
        >
          <svg
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 0 1-15.4 6.4L3 16" />
            <path d="M3 21v-5h5" />
            <path d="M3 12A9 9 0 0 1 18.4 5.6L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
          {loading ? "Refreshing" : "Refresh"}
        </button>
        <button
          type="button"
          className="dashboard-app-btn dashboard-app-btn--amber"
          onClick={() => void claimNow()}
          disabled={claiming}
          aria-label="Claim backlog issue now"
        >
          <svg
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="m5 12 14-7-7 14-2-7-5-0Z" />
          </svg>
          {claiming ? "Claiming" : "Claim Now"}
        </button>
        <button
          type="button"
          className={
            pollerPaused ? "dashboard-app-btn dashboard-app-btn--amber" : "dashboard-app-btn"
          }
          onClick={() => void setPoller(pollerPaused ? "start" : "stop")}
          disabled={loading}
          aria-label={pollerPaused ? "Start backlog poller" : "Stop backlog poller"}
        >
          <svg
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            {pollerPaused ? <path d="m8 5 11 7-11 7V5Z" /> : <path d="M8 5v14M16 5v14" />}
          </svg>
          {pollerPaused ? "Start" : "Stop"}
        </button>
        <button
          type="button"
          className="dashboard-app-btn"
          onClick={() => void setupLabels()}
          disabled={setupLoading}
          aria-label="Setup backlog labels"
        >
          <svg
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M20 7 9 18l-5-5" />
          </svg>
          {setupLoading ? "Setting" : "Labels"}
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-[6px] border border-[color-mix(in_srgb,var(--color-status-error)_28%,transparent)] bg-[color-mix(in_srgb,var(--color-status-error)_10%,transparent)] px-3 py-2 text-[11px] text-[var(--color-status-error)]">
          {error}
        </div>
      ) : null}
      {setupSummary ? (
        <div className="mt-3 text-[11px] text-[var(--color-text-muted)]">{setupSummary}</div>
      ) : null}

      {projectIssues.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {projectIssues.map((issue) => (
            <div
              key={`${issue.projectId}:${issue.id}`}
              className="flex items-center gap-3 rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2"
            >
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 text-[12px] font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
              >
                <span className="mr-2 text-[var(--color-text-muted)]">#{issue.id}</span>
                {issue.title}
              </a>
              <button
                type="button"
                className="dashboard-app-btn dashboard-app-btn--amber"
                onClick={() => void spawnIssue(issue.id)}
                disabled={spawningIssueId === issue.id}
                aria-label={`Start agent for issue ${issue.id}`}
              >
                <svg
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="m5 12 14-7-7 14-2-7-5-0Z" />
                </svg>
                {spawningIssueId === issue.id ? "Starting" : "Start"}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
