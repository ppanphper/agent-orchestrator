import { rmSync, writeFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BACKLOG_STATE_PATH = "/tmp/backlog-poller.json";

const {
  mockLoadConfig,
  mockGetGlobalConfigPath,
  MockConfigNotFoundError,
  mockRegister,
  mockCreateSessionManager,
  mockRegistry,
  tmuxPlugin,
  claudePlugin,
  codexPlugin,
  opencodePlugin,
  worktreePlugin,
  scmPlugin,
  trackerGithubPlugin,
  trackerLinearPlugin,
} = vi.hoisted(() => {
  const mockLoadConfig = vi.fn();
  const mockGetGlobalConfigPath = vi.fn();
  class MockConfigNotFoundError extends Error {
    constructor(message?: string) {
      super(message ?? "Config not found");
      this.name = "ConfigNotFoundError";
    }
  }
  const mockRegister = vi.fn();
  const mockCreateSessionManager = vi.fn();
  const mockRegistry = {
    register: mockRegister,
    get: vi.fn(),
    list: vi.fn(),
    loadBuiltins: vi.fn(),
    loadFromConfig: vi.fn(),
  };

  return {
    mockLoadConfig,
    mockGetGlobalConfigPath,
    MockConfigNotFoundError,
    mockRegister,
    mockCreateSessionManager,
    mockRegistry,
    tmuxPlugin: { manifest: { name: "tmux" } },
    claudePlugin: { manifest: { name: "claude-code" } },
    codexPlugin: { manifest: { name: "codex" } },
    opencodePlugin: { manifest: { name: "opencode" } },
    worktreePlugin: { manifest: { name: "worktree" } },
    scmPlugin: { manifest: { name: "github" } },
    trackerGithubPlugin: { manifest: { name: "github" } },
    trackerLinearPlugin: { manifest: { name: "linear" } },
  };
});

vi.mock("@aoagents/ao-core", () => ({
  loadConfig: mockLoadConfig,
  getGlobalConfigPath: mockGetGlobalConfigPath,
  ConfigNotFoundError: MockConfigNotFoundError,
  createPluginRegistry: () => mockRegistry,
  createSessionManager: mockCreateSessionManager,
  createLifecycleManager: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    getStates: vi.fn(),
    check: vi.fn(),
  }),
  isOrchestratorSession: () => false,
  TERMINAL_STATUSES: new Set(["merged", "killed"]) as ReadonlySet<string>,
}));

vi.mock("@aoagents/ao-plugin-runtime-tmux", () => ({ default: tmuxPlugin }));
vi.mock("@aoagents/ao-plugin-agent-claude-code", () => ({ default: claudePlugin }));
vi.mock("@aoagents/ao-plugin-agent-codex", () => ({ default: codexPlugin }));
vi.mock("@aoagents/ao-plugin-agent-opencode", () => ({ default: opencodePlugin }));
vi.mock("@aoagents/ao-plugin-workspace-worktree", () => ({ default: worktreePlugin }));
vi.mock("@aoagents/ao-plugin-scm-github", () => ({ default: scmPlugin }));
vi.mock("@aoagents/ao-plugin-tracker-github", () => ({ default: trackerGithubPlugin }));
vi.mock("@aoagents/ao-plugin-tracker-linear", () => ({ default: trackerLinearPlugin }));

describe("services", () => {
  beforeEach(() => {
    vi.resetModules();
    mockRegister.mockClear();
    mockCreateSessionManager.mockReset();
    mockLoadConfig.mockReset();
    mockGetGlobalConfigPath.mockReset();
    mockGetGlobalConfigPath.mockReturnValue("/tmp/global-config.yaml");
    mockLoadConfig.mockReturnValue({
      configPath: "/tmp/agent-orchestrator.yaml",
      port: 3000,
      readyThresholdMs: 300_000,
      defaults: { runtime: "tmux", agent: "claude-code", workspace: "worktree", notifiers: [] },
      projects: {},
      notifiers: {},
      notificationRouting: { urgent: [], action: [], warning: [], info: [] },
      reactions: {},
    });
    mockCreateSessionManager.mockReturnValue({});
    delete (globalThis as typeof globalThis & { _aoServices?: unknown })._aoServices;
    delete (globalThis as typeof globalThis & { _aoServicesInit?: unknown })._aoServicesInit;
    delete (globalThis as typeof globalThis & { _aoBacklogStarted?: unknown })._aoBacklogStarted;
    delete (globalThis as typeof globalThis & { _aoBacklogTimer?: unknown })._aoBacklogTimer;
    delete (globalThis as typeof globalThis & { _aoBacklogPollInFlight?: unknown })
      ._aoBacklogPollInFlight;
    rmSync(BACKLOG_STATE_PATH, { force: true });
  });

  afterEach(() => {
    delete (globalThis as typeof globalThis & { _aoServices?: unknown })._aoServices;
    delete (globalThis as typeof globalThis & { _aoServicesInit?: unknown })._aoServicesInit;
    delete (globalThis as typeof globalThis & { _aoBacklogStarted?: unknown })._aoBacklogStarted;
    delete (globalThis as typeof globalThis & { _aoBacklogTimer?: unknown })._aoBacklogTimer;
    delete (globalThis as typeof globalThis & { _aoBacklogPollInFlight?: unknown })
      ._aoBacklogPollInFlight;
    rmSync(BACKLOG_STATE_PATH, { force: true });
  });

  it("registers the OpenCode agent plugin with web services", async () => {
    const { getServices } = await import("../lib/services");

    await getServices();

    expect(mockRegister).toHaveBeenCalledWith(opencodePlugin);
  });

  it("registers the Codex agent plugin with web services", async () => {
    const { getServices } = await import("../lib/services");

    await getServices();

    expect(mockRegister).toHaveBeenCalledWith(codexPlugin);
  });

  it("caches initialized services across repeated calls", async () => {
    const { getServices } = await import("../lib/services");

    const first = await getServices();
    const second = await getServices();

    expect(first).toBe(second);
    expect(mockCreateSessionManager).toHaveBeenCalledTimes(1);
  });

  it("loads config from the canonical global config path", async () => {
    const { getServices } = await import("../lib/services");

    await getServices();

    expect(mockGetGlobalConfigPath).toHaveBeenCalledTimes(1);
    expect(mockLoadConfig).toHaveBeenCalledWith("/tmp/global-config.yaml");
  });

  it("falls back to discovered config when the canonical global config is missing", async () => {
    mockLoadConfig
      .mockImplementationOnce(() => {
        const error = new Error("ENOENT: no such file or directory");
        (error as Error & { code?: string }).code = "ENOENT";
        throw error;
      })
      .mockReturnValueOnce({
        configPath: "/tmp/local/agent-orchestrator.yaml",
        port: 3000,
        readyThresholdMs: 300_000,
        defaults: { runtime: "tmux", agent: "claude-code", workspace: "worktree", notifiers: [] },
        projects: {},
        notifiers: {},
        notificationRouting: { urgent: [], action: [], warning: [], info: [] },
        reactions: {},
      });

    const { getServices } = await import("../lib/services");

    await getServices();

    expect(mockLoadConfig).toHaveBeenNthCalledWith(1, "/tmp/global-config.yaml");
    expect(mockLoadConfig).toHaveBeenNthCalledWith(2);
  });
});

describe("pollBacklog", () => {
  const mockUpdateIssue = vi.fn();
  const mockListIssues = vi.fn();
  const mockSpawn = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    mockRegister.mockClear();
    mockCreateSessionManager.mockReset();
    mockLoadConfig.mockReset();
    mockUpdateIssue.mockClear();
    mockListIssues.mockClear();
    mockSpawn.mockClear();

    mockLoadConfig.mockReturnValue({
      configPath: "/tmp/agent-orchestrator.yaml",
      port: 3000,
      readyThresholdMs: 300_000,
      defaults: { runtime: "tmux", agent: "claude-code", workspace: "worktree", notifiers: [] },
      projects: {
        "test-project": {
          path: "/tmp/test-project",
          tracker: { plugin: "github" },
          backlog: { label: "agent:backlog", maxConcurrent: 5 },
        },
      },
      notifiers: {},
      notificationRouting: { urgent: [], action: [], warning: [], info: [] },
      reactions: {},
    });

    mockCreateSessionManager.mockReturnValue({
      spawn: mockSpawn,
      list: vi.fn().mockResolvedValue([]),
    });

    delete (globalThis as typeof globalThis & { _aoServices?: unknown })._aoServices;
    delete (globalThis as typeof globalThis & { _aoServicesInit?: unknown })._aoServicesInit;
    delete (globalThis as typeof globalThis & { _aoBacklogStarted?: unknown })._aoBacklogStarted;
    delete (globalThis as typeof globalThis & { _aoBacklogTimer?: unknown })._aoBacklogTimer;
    delete (globalThis as typeof globalThis & { _aoBacklogPollInFlight?: unknown })
      ._aoBacklogPollInFlight;
    rmSync(BACKLOG_STATE_PATH, { force: true });
  });

  afterEach(() => {
    delete (globalThis as typeof globalThis & { _aoServices?: unknown })._aoServices;
    delete (globalThis as typeof globalThis & { _aoServicesInit?: unknown })._aoServicesInit;
    delete (globalThis as typeof globalThis & { _aoBacklogStarted?: unknown })._aoBacklogStarted;
    delete (globalThis as typeof globalThis & { _aoBacklogTimer?: unknown })._aoBacklogTimer;
    delete (globalThis as typeof globalThis & { _aoBacklogPollInFlight?: unknown })
      ._aoBacklogPollInFlight;
    rmSync(BACKLOG_STATE_PATH, { force: true });
  });

  it("removes agent:backlog label when claiming an issue", async () => {
    mockListIssues.mockResolvedValue([
      {
        id: "123",
        title: "Test Issue",
        description: "Test description",
        url: "https://github.com/test/test/issues/123",
        state: "open",
        labels: ["agent:backlog"],
      },
    ]);

    mockRegistry.get.mockImplementation((slot: string) => {
      if (slot === "tracker") {
        return {
          name: "github",
          listIssues: mockListIssues,
          updateIssue: mockUpdateIssue,
        };
      }
      if (slot === "agent") {
        return { name: "claude-code" };
      }
      if (slot === "runtime") {
        return { name: "tmux" };
      }
      if (slot === "workspace") {
        return { name: "worktree" };
      }
      return null;
    });

    const { pollBacklog } = await import("../lib/services");
    await pollBacklog();

    expect(mockUpdateIssue).toHaveBeenCalledWith(
      "123",
      {
        labels: ["agent:in-progress"],
        removeLabels: ["agent:backlog"],
        comment: "Claimed by agent orchestrator — session spawned.",
      },
      expect.objectContaining({ tracker: { plugin: "github" } }),
    );
  });

  it("does not claim issues while the backlog poller is paused", async () => {
    mockListIssues.mockResolvedValue([
      {
        id: "123",
        title: "Test Issue",
        description: "Test description",
        url: "https://github.com/test/test/issues/123",
        state: "open",
        labels: ["agent:backlog"],
      },
    ]);

    mockRegistry.get.mockImplementation((slot: string) => {
      if (slot === "tracker") {
        return {
          name: "github",
          listIssues: mockListIssues,
          updateIssue: mockUpdateIssue,
        };
      }
      return null;
    });

    const { pollBacklog, stopBacklogPoller } = await import("../lib/services");
    stopBacklogPoller();
    await pollBacklog();

    expect(mockSpawn).not.toHaveBeenCalled();
    expect(mockUpdateIssue).not.toHaveBeenCalled();
  });

  it("allows a manual claim cycle while the backlog poller is paused", async () => {
    mockListIssues.mockResolvedValue([
      {
        id: "123",
        title: "Test Issue",
        description: "Test description",
        url: "https://github.com/test/test/issues/123",
        state: "open",
        labels: ["agent:backlog"],
      },
    ]);

    mockRegistry.get.mockImplementation((slot: string) => {
      if (slot === "tracker") {
        return {
          name: "github",
          listIssues: mockListIssues,
          updateIssue: mockUpdateIssue,
        };
      }
      return null;
    });

    const { claimBacklogNow, stopBacklogPoller } = await import("../lib/services");
    stopBacklogPoller();
    await claimBacklogNow();

    expect(mockSpawn).toHaveBeenCalledWith({ projectId: "test-project", issueId: "123" });
    expect(mockUpdateIssue).toHaveBeenCalledWith(
      "123",
      expect.objectContaining({
        labels: ["agent:in-progress"],
        removeLabels: ["agent:backlog"],
      }),
      expect.objectContaining({ tracker: { plugin: "github" } }),
    );
  });

  it("only polls explicitly started projects in project-scoped backlog mode", async () => {
    mockLoadConfig.mockReturnValue({
      configPath: "/tmp/agent-orchestrator.yaml",
      port: 3000,
      readyThresholdMs: 300_000,
      defaults: { runtime: "tmux", agent: "claude-code", workspace: "worktree", notifiers: [] },
      projects: {
        "test-project": {
          path: "/tmp/test-project",
          tracker: { plugin: "github" },
          backlog: { label: "agent:backlog", maxConcurrent: 5 },
        },
        "other-project": {
          path: "/tmp/other-project",
          tracker: { plugin: "github" },
          backlog: { label: "agent:backlog", maxConcurrent: 5 },
        },
      },
      notifiers: {},
      notificationRouting: { urgent: [], action: [], warning: [], info: [] },
      reactions: {},
    });
    writeFileSync(
      BACKLOG_STATE_PATH,
      JSON.stringify({
        paused: false,
        maxConcurrent: 5,
        projects: {
          "test-project": { paused: false, maxConcurrent: 5 },
        },
      }),
      "utf8",
    );
    mockListIssues.mockImplementation((_filters, project) =>
      Promise.resolve([
        {
          id: project.path.includes("other-project") ? "999" : "123",
          title: project.path.includes("other-project") ? "Other Issue" : "Test Issue",
          description: "Test description",
          url: `https://github.com/test/test/issues/${
            project.path.includes("other-project") ? "999" : "123"
          }`,
          state: "open",
          labels: ["agent:backlog"],
        },
      ]),
    );

    mockRegistry.get.mockImplementation((slot: string) => {
      if (slot === "tracker") {
        return {
          name: "github",
          listIssues: mockListIssues,
          updateIssue: mockUpdateIssue,
        };
      }
      return null;
    });

    const { pollBacklog } = await import("../lib/services");
    await pollBacklog();

    expect(mockListIssues).toHaveBeenCalled();
    expect(
      mockListIssues.mock.calls.every(([, project]) => project.path === "/tmp/test-project"),
    ).toBe(true);
    expect(mockListIssues).toHaveBeenCalledWith(
      { state: "open", labels: ["agent:backlog"], limit: 10 },
      expect.objectContaining({ path: "/tmp/test-project" }),
    );
    expect(mockSpawn).toHaveBeenCalledWith({ projectId: "test-project", issueId: "123" });
    expect(mockSpawn).not.toHaveBeenCalledWith({
      projectId: "other-project",
      issueId: "999",
    });
  });

  it("respects the configured max concurrent backlog agents", async () => {
    mockCreateSessionManager.mockReturnValue({
      spawn: mockSpawn,
      list: vi.fn().mockResolvedValue([
        {
          id: "session-1",
          projectId: "test-project",
          status: "running",
          lifecycle: { pr: { state: "none" } },
        },
        {
          id: "session-2",
          projectId: "test-project",
          status: "running",
          lifecycle: { pr: { state: "none" } },
        },
      ]),
    });
    mockListIssues.mockResolvedValue([
      {
        id: "123",
        title: "Test Issue",
        description: "Test description",
        url: "https://github.com/test/test/issues/123",
        state: "open",
        labels: ["agent:backlog"],
      },
    ]);

    mockRegistry.get.mockImplementation((slot: string) => {
      if (slot === "tracker") {
        return {
          name: "github",
          listIssues: mockListIssues,
          updateIssue: mockUpdateIssue,
        };
      }
      return null;
    });

    const { claimBacklogNow, setBacklogMaxConcurrent } = await import("../lib/services");
    setBacklogMaxConcurrent(2);
    await claimBacklogNow();

    expect(mockSpawn).not.toHaveBeenCalled();
    expect(mockUpdateIssue).not.toHaveBeenCalledWith(
      "123",
      expect.objectContaining({
        labels: ["agent:in-progress"],
        removeLabels: ["agent:backlog"],
      }),
      expect.anything(),
    );
  });
});
