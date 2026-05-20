import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { BacklogPanel } from "../BacklogPanel";

const fetchMock = vi.fn();

describe("BacklogPanel", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads project backlog issues on mount", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          poller: { running: true, paused: false, maxConcurrent: 7 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          poller: { running: true, paused: false, maxConcurrent: 7 },
          issues: [
            {
              projectId: "app",
              id: "42",
              title: "Fix upload progress",
              url: "https://github.com/acme/app/issues/42",
              labels: ["agent:backlog"],
            },
            {
              projectId: "other",
              id: "9",
              title: "Other project",
              labels: ["agent:backlog"],
            },
          ],
        }),
      } as Response);

    render(<BacklogPanel projectId="app" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/backlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", projectId: "app" }),
      });
      expect(fetchMock).toHaveBeenCalledWith("/api/backlog?projectId=app", { cache: "no-store" });
    });
    expect(await screen.findByText("Fix upload progress")).toBeInTheDocument();
    expect(screen.queryByText("Other project")).not.toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Max concurrent backlog agents" })).toHaveValue(
      7,
    );
  });

  it("can request label setup", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          poller: { running: true, paused: false, maxConcurrent: 5 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          issues: [],
          poller: { running: true, paused: false, maxConcurrent: 5 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ status: "created" }] }),
      } as Response);

    render(<BacklogPanel projectId="app" />);

    fireEvent.click(await screen.findByRole("button", { name: "Setup backlog labels" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/setup-labels", { method: "POST" });
    });
    expect(await screen.findByText("Labels ready")).toBeInTheDocument();
  });

  it("can pause the backlog poller", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          poller: { running: true, paused: false, maxConcurrent: 5 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          issues: [],
          poller: { running: true, paused: false, maxConcurrent: 5 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ poller: { running: false, paused: true, maxConcurrent: 5 } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          issues: [],
          poller: { running: false, paused: true, maxConcurrent: 5 },
        }),
      } as Response);

    render(<BacklogPanel projectId="app" />);

    fireEvent.click(await screen.findByRole("button", { name: "Stop backlog poller" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/backlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop", projectId: "app" }),
      });
    });
    expect(await screen.findByRole("button", { name: "Start backlog poller" })).toBeInTheDocument();
    expect(await screen.findByText("Paused")).toBeInTheDocument();
  });

  it("shows a stopped poller as startable after the server restarts", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          poller: { running: false, paused: false, maxConcurrent: 5 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          issues: [],
          poller: { running: false, paused: false, maxConcurrent: 5 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ poller: { running: true, paused: false, maxConcurrent: 5 } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          issues: [],
          poller: { running: true, paused: false, maxConcurrent: 5 },
        }),
      } as Response);

    render(<BacklogPanel projectId="app" />);

    expect(await screen.findByText("Not running")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Start backlog poller" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/backlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", projectId: "app" }),
      });
    });
    expect(await screen.findByRole("button", { name: "Stop backlog poller" })).toBeInTheDocument();
  });

  it("can run a manual claim cycle", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          poller: { running: false, paused: true, maxConcurrent: 5 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          issues: [],
          poller: { running: false, paused: true, maxConcurrent: 5 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          issues: [],
          poller: { running: false, paused: true, maxConcurrent: 5 },
        }),
      } as Response);

    render(<BacklogPanel projectId="app" />);

    fireEvent.click(await screen.findByRole("button", { name: "Claim backlog issue now" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/backlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim-now", projectId: "app" }),
      });
    });
  });

  it("can update the backlog concurrency limit", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          poller: { running: true, paused: false, maxConcurrent: 5 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          issues: [],
          poller: { running: true, paused: false, maxConcurrent: 5 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ poller: { running: true, paused: false, maxConcurrent: 3 } }),
      } as Response);

    render(<BacklogPanel projectId="app" />);

    fireEvent.change(
      await screen.findByRole("spinbutton", { name: "Max concurrent backlog agents" }),
      {
        target: { value: "3" },
      },
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/backlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set-max-concurrent",
          maxConcurrent: 3,
          projectId: "app",
        }),
      });
    });
  });

  it("renders backlog controls in Chinese locale", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          poller: { running: true, paused: false, maxConcurrent: 5 },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          issues: [],
          poller: { running: true, paused: false, maxConcurrent: 5 },
        }),
      } as Response);

    render(
      <I18nProvider locale="zh-CN">
        <BacklogPanel projectId="app" />
      </I18nProvider>,
    );

    expect(await screen.findByRole("heading", { name: "待办" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "刷新待办" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "立即认领待办议题" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "待办 Agent 最大并发数" })).toBeInTheDocument();
  });
});
