"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  deriveProjectIdFromPath,
  deriveProjectNameFromPath,
  getParentBrowsePath,
  joinBrowsePath,
  RefreshIcon,
  saveRecentPath,
} from "@/components/AddProjectModal.parts";
import { useI18n } from "@/lib/i18n";

interface BrowseEntry {
  name: string;
  isDirectory: boolean;
  isGitRepo: boolean;
  hasLocalConfig: boolean;
  modifiedAt?: number;
}

interface CollisionState {
  error: string;
  existingProjectId: string;
  suggestedProjectId: string;
  suggestion: "choose-project-id";
}

interface AddProjectModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddProjectModal({ open, onClose }: AddProjectModalProps) {
  const { t } = useI18n();
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [collision, setCollision] = useState<CollisionState | null>(null);
  const [browsePath, setBrowsePath] = useState("~");
  const [selectedBrowsePath, setSelectedBrowsePath] = useState("~");
  const [browseHistory, setBrowseHistory] = useState<string[]>(["~"]);
  const [browseHistoryIndex, setBrowseHistoryIndex] = useState(0);
  const [browseEntries, setBrowseEntries] = useState<BrowseEntry[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [projectIdInput, setProjectIdInput] = useState("");
  const [projectNameInput, setProjectNameInput] = useState("");

  const browse = async (
    path: string,
    options?: { mode?: "push" | "replace"; selectedPath?: string; historyIndex?: number },
  ) => {
    setBrowseLoading(true);
    setBrowseError(null);
    try {
      const response = await fetch(`/api/filesystem/browse?path=${encodeURIComponent(path)}`).catch(
        () => null,
      );
      if (!response) {
        setBrowseEntries([]);
        setSelectedBrowsePath(options?.selectedPath ?? path);
        setBrowseError(t("addProject.browseFailed"));
        return;
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          entries?: BrowseEntry[];
        } | null;
        setBrowseEntries([]);
        setSelectedBrowsePath(options?.selectedPath ?? path);
        setBrowseError(body?.error ?? t("addProject.browseFailed"));
        return;
      }

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        entries?: BrowseEntry[];
      } | null;
      const mode = options?.mode ?? "push";
      const targetHistoryIndex = options?.historyIndex ?? browseHistoryIndex;
      setBrowsePath(path);
      setSelectedBrowsePath(options?.selectedPath ?? path);
      setBrowseEntries(body?.entries ?? []);
      if (mode === "push") {
        setBrowseHistory((current) => {
          const next = current.slice(0, targetHistoryIndex + 1);
          if (next[next.length - 1] !== path) next.push(path);
          setBrowseHistoryIndex(next.length - 1);
          return next;
        });
      } else {
        setBrowseHistory((current) => {
          const next = [...current];
          next[targetHistoryIndex] = path;
          return next;
        });
      }
    } catch {
      setBrowseError(t("addProject.browseFailed"));
    } finally {
      setBrowseLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const initialPath = "~";
    setInlineError(null);
    setNetworkError(null);
    setCollision(null);
    setBrowseError(null);
    setBrowseHistory([initialPath]);
    setBrowseHistoryIndex(0);
    setBrowsePath(initialPath);
    setSelectedBrowsePath(initialPath);
    setProjectIdInput("");
    setProjectNameInput("");
    modalRef.current?.focus();
    void browse(initialPath, { mode: "replace", selectedPath: initialPath });
  }, [open]);

  const directoryEntries = useMemo(
    () => browseEntries.filter((entry) => entry.isDirectory),
    [browseEntries],
  );
  const selectedEntry = useMemo(
    () =>
      directoryEntries.find(
        (entry) => joinBrowsePath(browsePath, entry.name) === selectedBrowsePath,
      ) ?? null,
    [browsePath, directoryEntries, selectedBrowsePath],
  );
  const parentPath = getParentBrowsePath(browsePath);
  const canGoBack = browseHistoryIndex > 0;
  const canGoForward = browseHistoryIndex < browseHistory.length - 1;
  const projectIdValue =
    projectIdInput.trim() ||
    (selectedBrowsePath.trim() && selectedBrowsePath !== "~"
      ? deriveProjectIdFromPath(selectedBrowsePath)
      : "");
  const projectNameValue =
    projectNameInput.trim() ||
    (selectedBrowsePath.trim() && selectedBrowsePath !== "~"
      ? deriveProjectNameFromPath(selectedBrowsePath)
      : "");
  const canSubmit =
    selectedBrowsePath.trim() !== "" &&
    selectedBrowsePath !== "~" &&
    !browseError &&
    Boolean(selectedEntry?.isGitRepo) &&
    projectIdValue.length > 0 &&
    projectNameValue.length > 0;
  const selectedIndex = directoryEntries.findIndex(
    (entry) => joinBrowsePath(browsePath, entry.name) === selectedBrowsePath,
  );

  useEffect(() => {
    if (!selectedBrowsePath || selectedBrowsePath === "~") {
      setProjectIdInput("");
      setProjectNameInput("");
      return;
    }

    setProjectIdInput(deriveProjectIdFromPath(selectedBrowsePath));
    setProjectNameInput(deriveProjectNameFromPath(selectedBrowsePath));
  }, [selectedBrowsePath]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !modalRef.current?.contains(document.activeElement) &&
        document.activeElement !== document.body
      )
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canSubmit) {
        event.preventDefault();
        void submit();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (directoryEntries.length === 0) return;
        event.preventDefault();
        const offset = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex =
          selectedIndex === -1
            ? offset > 0
              ? 0
              : directoryEntries.length - 1
            : Math.min(Math.max(selectedIndex + offset, 0), directoryEntries.length - 1);
        const nextEntry = directoryEntries[nextIndex];
        if (nextEntry) setSelectedBrowsePath(joinBrowsePath(browsePath, nextEntry.name));
        return;
      }
      if (event.key === "Enter") {
        if (selectedIndex >= 0) {
          event.preventDefault();
          void browse(selectedBrowsePath);
          return;
        }
        if (canSubmit) {
          event.preventDefault();
          void submit();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [browsePath, canSubmit, directoryEntries, onClose, open, selectedBrowsePath, selectedIndex]);

  const submit = async (useDefaultProjectId = false) => {
    setInlineError(null);
    setNetworkError(null);
    setCollision(null);
    setSubmitting(true);
    const resolvedPath = selectedBrowsePath.trim();
    const projectId = projectIdValue;
    const name = projectNameValue;
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, name, path: resolvedPath, useDefaultProjectId }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        projectId?: string;
        existingProjectId?: string;
        suggestedProjectId?: string;
        suggestion?: "choose-project-id";
      } | null;
      if (
        response.status === 409 &&
        body?.existingProjectId &&
        body?.suggestedProjectId &&
        body?.suggestion
      ) {
        setCollision({
          error: body.error ?? t("addProject.idExists"),
          existingProjectId: body.existingProjectId,
          suggestedProjectId: body.suggestedProjectId,
          suggestion: body.suggestion,
        });
        setProjectIdInput(body.suggestedProjectId);
        return;
      }
      if (!response.ok) {
        const message = body?.error ?? t("addProject.addFailed");
        if (response.status < 500) setInlineError(message);
        else setNetworkError(message);
        return;
      }
      saveRecentPath(resolvedPath);
      const nextProjectId = body?.projectId ?? projectId.trim();
      onClose();
      router.push(`/projects/${encodeURIComponent(nextProjectId)}`);
      router.refresh();
    } catch {
      setNetworkError(t("addProject.networkAddFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const navigateHistory = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= browseHistory.length) return;
    setBrowseHistoryIndex(nextIndex);
    void browse(browseHistory[nextIndex] ?? "~", { mode: "replace", historyIndex: nextIndex });
  };

  const selectedNotice = collision ? (
    <div className="add-project-modal__notice add-project-modal__notice--warning">
      <p className="add-project-modal__notice-title">{collision.error}</p>
      <p className="add-project-modal__notice-copy">
        {t("addProject.existingProject")} <code>{collision.existingProjectId}</code>
      </p>
      <p className="add-project-modal__notice-copy">
        {t("addProject.suggestedProjectId")} <code>{collision.suggestedProjectId}</code>
      </p>
      <div className="add-project-modal__notice-actions">
        <button
          type="button"
          onClick={() => {
            onClose();
            router.push(`/projects/${encodeURIComponent(collision.existingProjectId)}`);
          }}
          className="add-project-modal__ghostbtn"
        >
          {t("addProject.openExisting")}
        </button>
        <button
          type="button"
          onClick={() => void submit(true)}
          className="add-project-modal__ghostbtn"
        >
          {t("addProject.useSuggestedId")}
        </button>
        <span className="add-project-modal__notice-hint">{t("addProject.editHint")}</span>
      </div>
    </div>
  ) : inlineError ? (
    <div role="alert" className="add-project-modal__notice add-project-modal__notice--error">
      {inlineError}
    </div>
  ) : selectedEntry && !selectedEntry.isGitRepo ? (
    <div role="alert" className="add-project-modal__notice add-project-modal__notice--error">
      {t("addProject.selectedNotGit")}
    </div>
  ) : networkError ? (
    <div className="add-project-modal__notice add-project-modal__notice--error">{networkError}</div>
  ) : null;

  return (
    <div className="add-project-modal-backdrop">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("addProject.dialog")}
        className="add-project-modal"
        tabIndex={-1}
      >
        <div className="add-project-modal__titlebar">
          <h2 className="add-project-modal__windowtitle">{t("addProject.title")}</h2>
          <button
            type="button"
            aria-label={t("addProject.close")}
            onClick={onClose}
            className="add-project-modal__iconbtn"
          >
            ×
          </button>
        </div>
        <div className="add-project-modal__toolbar">
          <div className="add-project-modal__toolbarcluster">
            <button
              type="button"
              onClick={() => navigateHistory(browseHistoryIndex - 1)}
              disabled={!canGoBack}
              className="add-project-modal__toolbtn"
              aria-label={t("addProject.goBack")}
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              onClick={() => navigateHistory(browseHistoryIndex + 1)}
              disabled={!canGoForward}
              className="add-project-modal__toolbtn"
              aria-label={t("addProject.goForward")}
            >
              <ChevronRightIcon />
            </button>
            <button
              type="button"
              onClick={() => parentPath && void browse(parentPath)}
              disabled={!parentPath}
              className="add-project-modal__toolbtn"
              aria-label={t("addProject.goUp")}
            >
              <ArrowUpIcon />
            </button>
            <button
              type="button"
              onClick={() =>
                void browse(browsePath, { mode: "replace", selectedPath: selectedBrowsePath })
              }
              className="add-project-modal__toolbtn"
              aria-label={t("addProject.refresh")}
            >
              <RefreshIcon />
            </button>
          </div>
          <div className="add-project-modal__location">{browsePath}</div>
        </div>

        <div className="add-project-modal__content">
          <div className="add-project-browser">
            <div className="add-project-browser__current">
              <div className="add-project-browser__current-label">
                {t("addProject.currentFolder")}
              </div>
              <div className="add-project-browser__current-path">{browsePath}</div>
            </div>
            {browseError ? (
              <div className="add-project-browser__state add-project-browser__state--error">
                <p className="add-project-browser__state-title">
                  {t("addProject.browserUnavailable")}
                </p>
                <p className="add-project-browser__state-copy">{browseError}</p>
              </div>
            ) : browseLoading ? (
              <div className="add-project-browser__state">
                <p className="add-project-browser__state-title">{t("addProject.loadingFolders")}</p>
                <p className="add-project-browser__state-copy">{t("addProject.fetchingFolders")}</p>
              </div>
            ) : directoryEntries.length === 0 ? (
              <div className="add-project-browser__state">
                <p className="add-project-browser__state-title">{t("addProject.noFolders")}</p>
                <p className="add-project-browser__state-copy">{t("addProject.noFoldersHint")}</p>
              </div>
            ) : (
              <div className="add-project-browser__rows">
                {parentPath ? (
                  <button
                    type="button"
                    onClick={() => void browse(parentPath)}
                    className="add-project-browser__row add-project-browser__row--parent"
                  >
                    ..
                  </button>
                ) : null}
                {directoryEntries.map((entry) => {
                  const nextPath = joinBrowsePath(browsePath, entry.name);
                  return (
                    <button
                      key={nextPath}
                      type="button"
                      onClick={() => setSelectedBrowsePath(nextPath)}
                      onDoubleClick={() => void browse(nextPath)}
                      className={`add-project-browser__row${selectedBrowsePath === nextPath ? " is-selected" : ""}`}
                    >
                      {entry.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="add-project-modal__pathbar add-project-modal__pathbar--selection">
          <span className="add-project-modal__selection-label">{t("addProject.selected")}</span>
          <span className="add-project-modal__selection-path">
            {selectedBrowsePath || t("addProject.noDirectorySelected")}
          </span>
        </div>
        <div className="add-project-modal__pathbar add-project-modal__pathbar--selection">
          <label className="add-project-modal__selection-label" htmlFor="project-id-input">
            {t("addProject.projectId")}
          </label>
          <input
            id="project-id-input"
            value={projectIdInput}
            onChange={(event) => setProjectIdInput(event.target.value)}
            className="add-project-modal__selection-path"
          />
        </div>
        <div className="add-project-modal__pathbar add-project-modal__pathbar--selection">
          <label className="add-project-modal__selection-label" htmlFor="project-name-input">
            {t("addProject.projectName")}
          </label>
          <input
            id="project-name-input"
            value={projectNameInput}
            onChange={(event) => setProjectNameInput(event.target.value)}
            className="add-project-modal__selection-path"
          />
        </div>
        {selectedNotice}

        <div className="add-project-modal__footer">
          <div className="add-project-modal__foldercount">
            {t("addProject.folders", { count: directoryEntries.length })}
          </div>
          <div className="add-project-modal__actions">
            <button type="button" onClick={onClose} className="add-project-modal__ghostbtn">
              {t("addProject.cancel")}
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit || submitting}
              className="add-project-modal__primarybtn"
            >
              {submitting ? t("addProject.adding") : t("addProject.addProject")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
