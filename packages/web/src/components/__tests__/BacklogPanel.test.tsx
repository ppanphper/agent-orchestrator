import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    fetchMock.mockResolvedValueOnce({
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

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/backlog", { cache: "no-store" }),
    );
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
        body: JSON.stringify({ action: "stop" }),
      });
    });
    expect(await screen.findByRole("button", { name: "Start backlog poller" })).toBeInTheDocument();
    expect(await screen.findByText("Paused")).toBeInTheDocument();
  });

  it("can run a manual claim cycle", async () => {
    fetchMock
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
        body: JSON.stringify({ action: "claim-now" }),
      });
    });
  });

  it("can update the backlog concurrency limit", async () => {
    fetchMock
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
        body: JSON.stringify({ action: "set-max-concurrent", maxConcurrent: 3 }),
      });
    });
  });
});
