# Open SWE Sandbox, Invocation, Middleware Migration Plan

## Purpose

This document records a read-only design analysis of how Open SWE's sandbox,
invocation, middleware, and organization customization patterns could be
merged into Agent Orchestrator (AO).

The goal is to make AO a stronger result-delivery agent orchestrator for this
flow:

```text
issue/task -> project routing -> branch/worktree/sandbox -> PR -> CI/review feedback -> merge readiness
```

Task platforms such as Linear, Jira, Feishu, GitHub Issues, OpenClaw, and
internal APIs should remain adapters. Core orchestration must not depend on
platform-specific payloads.

## Source Repositories Read

- Reference: `/Users/pandy/ai-code/open-swe`
- Target: `/Volumes/Extra disk/Directories/Users/pandy/ai-code/agent-orchestrator`

This analysis is based on read-only inspection. No implementation changes were
made while deriving the plan.

## Open SWE Observations

### Sandbox

Open SWE binds a sandbox to a LangGraph thread.

Important files:

- `/Users/pandy/ai-code/open-swe/agent/server.py`
- `/Users/pandy/ai-code/open-swe/agent/utils/sandbox.py`
- `/Users/pandy/ai-code/open-swe/agent/utils/sandbox_state.py`
- `/Users/pandy/ai-code/open-swe/agent/integrations/langsmith.py`
- `/Users/pandy/ai-code/open-swe/agent/integrations/daytona.py`
- `/Users/pandy/ai-code/open-swe/agent/integrations/runloop.py`
- `/Users/pandy/ai-code/open-swe/agent/integrations/modal.py`
- `/Users/pandy/ai-code/open-swe/agent/integrations/local.py`

Key behavior:

- `ensure_sandbox_for_thread()` gets or creates a healthy sandbox for a
  `thread_id`.
- `sandbox_id` is persisted in LangGraph thread metadata.
- `SANDBOX_BACKENDS` is an in-process cache keyed by `thread_id`.
- `SandboxBackendProxy` provides a stable backend handle whose underlying target
  can be replaced after a sandbox recreation.
- Sandbox creation handles four cases:
  - cached backend exists, ping it and recreate on failure;
  - metadata says `__creating__`, wait for creation to finish;
  - no sandbox exists, create and persist it;
  - metadata has an id but no cache exists, reconnect or recreate.
- Provider selection is environment-driven through `SANDBOX_TYPE`.
- LangSmith sandboxes get GitHub proxy rules configured with a short-lived
  GitHub App installation token. GitHub credentials are injected by proxy
  rather than stored inside the sandbox.
- Repo cloning is mostly left to the agent/tools inside the sandbox.

Design value for AO:

- The lifecycle pattern is useful: create, reconnect, ping, recreate, persist
  provider handle, and refresh credentials.
- The exact implementation should not be copied. AO already has explicit
  session, workspace, runtime, lifecycle, and plugin abstractions.

### Invocation

Open SWE accepts Slack, Linear, and GitHub events through FastAPI routes in:

- `/Users/pandy/ai-code/open-swe/agent/webapp.py`
- `/Users/pandy/ai-code/open-swe/agent/utils/slack.py`
- `/Users/pandy/ai-code/open-swe/agent/utils/linear.py`
- `/Users/pandy/ai-code/open-swe/agent/utils/github_comments.py`

Key behavior:

- Webhook handlers verify signatures, filter events, resolve repo context,
  construct prompts, and start LangGraph runs.
- Each source computes a deterministic thread id:
  - Linear issue id -> thread id;
  - Slack channel + thread timestamp -> thread id;
  - GitHub issue id or PR branch/PR number -> thread id.
- If the thread is active, follow-up messages are written to a store queue under
  `("queue", thread_id) / "pending_messages"`.
- If the thread is idle, a new LangGraph run is created with normalized
  configurable metadata such as `source`, `repo`, `linear_issue`,
  `slack_thread`, `github_issue`, or `github_login`.

Design value for AO:

- Deterministic correlation keys are essential for routing follow-up comments
  back to the same running agent.
- The queue pattern is useful.
- Open SWE's webhook implementation is too platform-coupled to migrate as-is.
  It combines verification, routing, prompt creation, auth, run creation, and
  follow-up queueing in one file.

### Middleware

Important files:

- `/Users/pandy/ai-code/open-swe/agent/middleware/check_message_queue.py`
- `/Users/pandy/ai-code/open-swe/agent/middleware/tool_error_handler.py`
- `/Users/pandy/ai-code/open-swe/agent/middleware/sandbox_circuit_breaker.py`
- `/Users/pandy/ai-code/open-swe/agent/middleware/notify_step_limit.py`
- `/Users/pandy/ai-code/open-swe/agent/middleware/model_fallback.py`
- `/Users/pandy/ai-code/open-swe/agent/middleware/refresh_slack_status.py`
- `/Users/pandy/ai-code/open-swe/agent/middleware/sanitize_tool_inputs.py`
- `/Users/pandy/ai-code/open-swe/agent/middleware/ensure_no_empty_msg.py`

Key behavior:

- `check_message_queue_before_model` injects queued follow-up messages before
  the next model call.
- `ToolErrorMiddleware` converts tool exceptions into structured tool messages
  instead of crashing the run.
- Sandbox errors can trigger sandbox recreation and return a recovery payload to
  the agent.
- `SandboxCircuitBreakerMiddleware` stops repeated unrecoverable sandbox
  failures and notifies Slack, Linear, or GitHub.
- `notify_step_limit_reached` posts a user-visible notification when model-call
  limits are hit.
- `ModelFallbackMiddleware` retries transient model/provider failures against a
  fallback model.
- `SlackAssistantStatusMiddleware` maintains Slack status while the agent is
  working.
- `SanitizeToolInputsMiddleware` fixes common malformed tool-call arguments
  deterministically.
- `ensure_no_empty_msg` prevents silent premature completion when the model
  emits neither useful content nor expected tool calls.

Design value for AO:

- Several behaviors currently handled by prompts or reactions should become
  deterministic lifecycle middleware.
- AO should not copy LangChain middleware APIs. It should define its own hooks
  around session lifecycle, external events, tool/runtime events where
  available, and readiness checks.

### Organization Customization

Important file:

- `/Users/pandy/ai-code/open-swe/CUSTOMIZATION.md`

Open SWE customization points:

- sandbox provider;
- sandbox snapshots;
- model and fallback model;
- tool list;
- trigger/webhook sources;
- repo routing from Slack/Linear/GitHub text or team mapping;
- system prompt and default org prompt;
- repo-local `AGENTS.md`;
- middleware stack.

Design value for AO:

- AO already has stronger plugin/config foundations.
- AO needs a clearer org policy layer for routing, status mapping, review gates,
  merge policy, and secret profiles.

## AO Observations

Important files:

- `/Volumes/Extra disk/Directories/Users/pandy/ai-code/agent-orchestrator/packages/core/src/types.ts`
- `/Volumes/Extra disk/Directories/Users/pandy/ai-code/agent-orchestrator/packages/core/src/session-manager.ts`
- `/Volumes/Extra disk/Directories/Users/pandy/ai-code/agent-orchestrator/packages/core/src/lifecycle-manager.ts`
- `/Volumes/Extra disk/Directories/Users/pandy/ai-code/agent-orchestrator/packages/core/src/config.ts`
- `/Volumes/Extra disk/Directories/Users/pandy/ai-code/agent-orchestrator/packages/web/src/app/api/webhooks/[...slug]/route.ts`
- `/Volumes/Extra disk/Directories/Users/pandy/ai-code/agent-orchestrator/packages/web/src/lib/scm-webhooks.ts`
- `/Volumes/Extra disk/Directories/Users/pandy/ai-code/agent-orchestrator/packages/plugins/workspace-worktree/src/index.ts`
- `/Volumes/Extra disk/Directories/Users/pandy/ai-code/agent-orchestrator/packages/plugins/workspace-clone/src/index.ts`
- `/Volumes/Extra disk/Directories/Users/pandy/ai-code/agent-orchestrator/packages/plugins/scm-github/src/index.ts`
- `/Volumes/Extra disk/Directories/Users/pandy/ai-code/agent-orchestrator/packages/plugins/tracker-linear/src/index.ts`

Existing strengths:

- AO already has explicit plugin slots for runtime, agent, workspace, tracker,
  SCM, notifier, and terminal.
- Sessions are persisted with canonical lifecycle state and legacy display
  status.
- Workspace isolation already supports worktree and clone modes.
- Runtime isolation already supports tmux and process modes.
- SCM plugins own PR, CI, review, and merge readiness.
- The lifecycle manager polls active sessions, emits events, dispatches
  reactions, and routes CI/review/merge-conflict feedback back to agents.
- Web dashboard consumes session metadata and lifecycle state.
- SCM webhooks already support verification/parsing through SCM plugins and
  trigger lifecycle checks for affected sessions.

Current gaps for an agent factory:

- There is no unified task ingestion model. SCM webhooks refresh existing
  sessions, but Linear/Jira/Feishu/GitHub Issues/OpenClaw task creation is not
  represented as a core flow.
- There is no generic follow-up event queue for "same task/thread while agent is
  already running."
- Workspace and runtime are separate, but there is no sandbox provider
  abstraction that owns isolation, workspace preparation, TTL, credential
  injection, and reconnect/recovery.
- Reactions are powerful but not a full lifecycle middleware pipeline.
- Organization policy is scattered across project config, plugin config,
  reactions, and custom prompt/rules fields.
- Platform-specific status and field mapping would become messy if implemented
  directly in core.

## Migration Judgment

### Directly Adopt the Pattern

#### Sandbox lifecycle state machine

Problem solved:

- Cloud or remote sandboxes can be evicted, paused, or lose connection.

AO gap:

- Worktree cleanup and runtime liveness exist, but sandbox identity/reconnect is
  not modeled.

Benefit:

- AO can support local worktree, Docker, Kubernetes, LangSmith, Daytona,
  Runloop, and other sandboxes without rewriting session lifecycle.

#### Follow-up queue

Problem solved:

- A user or upstream platform can add context while the agent is already
  running.

AO gap:

- Existing `sessionManager.send()` is direct, but there is no platform-neutral
  queue keyed by task/thread correlation.

Benefit:

- All adapters can route follow-ups deterministically to the same running
  session.

#### Deterministic middleware

Problem solved:

- Prompt-only reliability is brittle for tool errors, sandbox failures, CI
  failures, review comments, and step limits.

AO gap:

- AO has deterministic lifecycle/reactions, but the extension mechanism is not
  expressed as middleware hooks.

Benefit:

- Core state remains predictable while org-specific behavior becomes pluggable.

### Borrow, Do Not Copy

#### Open SWE webhook handlers

Reason:

- They combine platform parsing, auth, routing, queueing, prompt construction,
  and run creation.

AO target:

- Split this into EventAdapter, TaskInvocation, ProjectRouter, QueueAdapter, and
  SessionManager spawn.

#### LangGraph thread metadata

Reason:

- AO already has richer session metadata and canonical lifecycle.

AO target:

- Store invocation, task, sandbox, and readiness metadata in AO session metadata.

### Do Not Migrate

#### Platform fields in core lifecycle

Reason:

- Feishu, Jira, Linear, GitHub Issues, and OpenClaw have incompatible terms,
  status models, identity models, and comment formats.

AO target:

- Keep platform details in adapter plugins and org field mappings.

#### Agent-owned PR pipeline as the primary source of truth

Reason:

- Open SWE intentionally leaves PR opening/updating mostly to the agent.

AO target:

- Agents can still create PRs, but AO lifecycle manager and SCM plugins remain
  the source of truth for PR, CI, review, and merge readiness.

## Target Core Abstractions

### TaskInvocation

Reason:

- AO needs a platform-neutral unit of work.

Why AO is insufficient today:

- `SessionSpawnConfig` accepts project, issue, branch, and prompt, but it does
  not preserve source platform context, external thread identity, actor, field
  mapping, or follow-up routing.

Benefit:

- Task platforms can be added without changing core session/lifecycle logic.

```ts
export interface TaskInvocation {
  id: string;
  source: "linear" | "jira" | "feishu" | "github_issue" | "openclaw" | "api";
  externalTaskId: string;
  externalThreadId: string;
  title: string;
  body: string;
  actor: {
    id?: string;
    login?: string;
    email?: string;
    displayName?: string;
  };
  repoHint?: string;
  projectHint?: string;
  priority?: string;
  labels?: string[];
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  raw?: unknown;
}
```

### TaskContext

Reason:

- Once a task has been routed and accepted, AO needs durable context separate
  from the raw invocation.

Why AO is insufficient today:

- Session metadata stores issue id, branch, PR, and prompt, but not a normalized
  delivery contract.

Benefit:

- Dashboard, lifecycle, readiness policy, and notifiers can reason about the
  task independent of the source platform.

```ts
export interface TaskContext {
  invocationId: string;
  source: string;
  externalTaskId: string;
  externalThreadId: string;
  projectId: string;
  repo: string;
  branch: string;
  title: string;
  externalUrl?: string;
  actor?: TaskInvocation["actor"];
  status?: "queued" | "running" | "pr_open" | "blocked" | "ready" | "done";
}
```

### EventAdapter

Reason:

- Webhook and polling sources should standardize events before core sees them.

Why AO is insufficient today:

- SCM plugins parse SCM webhooks, but task creation/follow-up from trackers or
  chat systems is not modeled as a plugin contract.

Benefit:

- Linear/Jira/Feishu/GitHub Issues/OpenClaw adapters remain isolated.

```ts
export interface EventAdapter {
  readonly name: string;
  verify(request: AdapterRequest): Promise<AdapterVerificationResult>;
  parse(request: AdapterRequest): Promise<TaskInvocation | ExternalFollowupEvent | null>;
}
```

### QueueAdapter

Reason:

- AO needs durable, idempotent task and follow-up queues.

Why AO is insufficient today:

- A running session can receive direct messages, but there is no source-neutral
  queue with external correlation keys.

Benefit:

- Follow-up comments can be queued and injected when the agent is ready or at a
  middleware boundary.

```ts
export interface QueueAdapter {
  enqueue(invocation: TaskInvocation): Promise<void>;
  enqueueFollowup(event: ExternalFollowupEvent): Promise<void>;
  claimNext(projectId?: string): Promise<TaskInvocation | null>;
  listPending?(filter?: QueueFilter): Promise<QueuedTask[]>;
}
```

### ProjectRouter

Reason:

- `issue/task -> project routing` is part of the core factory flow.

Why AO is insufficient today:

- Projects are configured, but routing an arbitrary upstream task to a project
  depends on ad hoc tracker/repo logic.

Benefit:

- Org routing can be tested deterministically.

```ts
export interface ProjectRouter {
  route(invocation: TaskInvocation, policy: OrgPolicy): Promise<ProjectRouteDecision>;
}
```

### SandboxProvider

Reason:

- AO needs a stronger isolation abstraction than workspace alone.

Why AO is insufficient today:

- Workspace plugins create worktrees/clones. Runtime plugins spawn processes.
  Neither owns remote sandbox identity, TTL, reconnect, credential profile, or
  provider health.

Benefit:

- Existing worktree mode becomes a default sandbox provider while remote
  providers can be added.

```ts
export interface SandboxProvider {
  readonly name: string;
  create(context: SandboxCreateContext): Promise<SandboxHandle>;
  reconnect(handle: SandboxHandle): Promise<SandboxHandle>;
  ping(handle: SandboxHandle): Promise<boolean>;
  destroy(handle: SandboxHandle): Promise<void>;
  prepareGitAuth?(handle: SandboxHandle, profile: SecretProfile): Promise<void>;
  resolveWorkspace?(handle: SandboxHandle): Promise<string>;
}
```

### AgentLifecycleMiddleware

Reason:

- AO needs deterministic hooks around delivery workflow, not just event
  reactions after status transitions.

Why AO is insufficient today:

- `lifecycle-manager.ts` owns polling, transition detection, reaction dispatch,
  CI details, review backlog, merge conflicts, and report watcher logic.

Benefit:

- Reliability features can be added without continuously expanding the central
  lifecycle manager.

```ts
export interface AgentLifecycleMiddleware {
  readonly name: string;
  beforeRun?(ctx: AgentRunContext): Promise<void>;
  beforeModelStep?(ctx: AgentRunContext): Promise<void>;
  afterModelStep?(ctx: AgentRunContext): Promise<void>;
  afterToolCall?(ctx: AgentRunContext, call: ToolCallResult): Promise<void>;
  afterTurn?(ctx: AgentRunContext): Promise<void>;
  onExternalEvent?(ctx: AgentRunContext, event: ExternalFollowupEvent): Promise<void>;
  onFailure?(ctx: AgentRunContext, error: unknown): Promise<void>;
  onReadinessCheck?(ctx: AgentRunContext): Promise<ReadinessDecision | void>;
}
```

### OrgPolicy

Reason:

- Result delivery depends on organization-specific rules.

Why AO is insufficient today:

- AO has project configs and reactions, but policy concepts such as repo
  mapping, status mapping, review gates, merge gates, field mapping, and secret
  profiles are not first-class.

Benefit:

- Platform differences stay outside core and delivery decisions become auditable.

```ts
export interface OrgPolicy {
  projectRouting: RoutingRule[];
  repoMapping: RepoMappingRule[];
  statusMapping: StatusMappingRule[];
  reviewPolicy: ReviewPolicy;
  ciGates: CIGatePolicy;
  mergePolicy: MergePolicy;
  fieldMapping: Record<string, string>;
  secretProfile?: string;
}
```

## Expected File Changes

New core modules:

- `packages/core/src/task-invocation.ts`
- `packages/core/src/task-context.ts`
- `packages/core/src/event-adapter.ts`
- `packages/core/src/task-queue.ts`
- `packages/core/src/project-router.ts`
- `packages/core/src/org-policy.ts`
- `packages/core/src/sandbox-provider.ts`
- `packages/core/src/lifecycle-middleware.ts`
- `packages/core/src/readiness-policy.ts`

New or adjusted plugins:

- `packages/plugins/event-linear/`
- `packages/plugins/event-github-issues/`
- `packages/plugins/event-openclaw/`
- `packages/plugins/event-jira/`
- `packages/plugins/event-feishu/`
- `packages/plugins/sandbox-worktree/`
- `packages/plugins/sandbox-docker/`
- optional future `packages/plugins/sandbox-langsmith/`,
  `sandbox-daytona/`, `sandbox-runloop/`

Core files likely to change:

- `packages/core/src/types.ts`
- `packages/core/src/config.ts`
- `schema/config.schema.json`
- `packages/core/src/session-manager.ts`
- `packages/core/src/lifecycle-manager.ts`
- `packages/core/src/plugin-registry.ts`
- `packages/core/src/index.ts`

Web/API files likely to change:

- `packages/web/src/app/api/webhooks/[...slug]/route.ts`
- new `packages/web/src/app/api/invocations/[...slug]/route.ts`
- dashboard session types and components for task/sandbox/readiness fields

## Data Model Changes

Session metadata should gain these optional fields:

- `taskContext`: JSON-encoded `TaskContext`
- `invocation`: compact JSON summary of `TaskInvocation`
- `externalThreadId`
- `externalTaskId`
- `sourceAdapter`
- `sandboxHandle`
- `sandboxProvider`
- `readiness`
- `readinessBlockers`
- `policyProfile`
- `secretProfile`

These should be additive and optional so existing sessions remain readable.

## Flow Change

Target flow:

1. An external platform event reaches an EventAdapter endpoint.
2. The adapter verifies the request and parses it into `TaskInvocation` or
   `ExternalFollowupEvent`.
3. AO computes an idempotency key from source, external task id, and external
   thread id.
4. If this is a new task, QueueAdapter stores it.
5. ProjectRouter evaluates OrgPolicy and picks project, repo, branch strategy,
   agent, sandbox profile, and merge policy.
6. SessionManager creates or reuses a session:
   - persist `TaskContext`;
   - create sandbox through SandboxProvider;
   - create workspace/runtime through existing providers or sandbox-owned
     equivalents;
   - launch the selected agent.
7. If a follow-up arrives while the session is active, QueueAdapter stores it
   and middleware injects it into the running agent at the next safe boundary.
8. SCM plugins continue to detect PR, CI, review, mergeability, and conflicts.
9. Lifecycle middleware turns CI/review/conflict/readiness changes into
   deterministic actions:
   - send enriched context to agent;
   - notify human;
   - mark blocked;
   - evaluate merge readiness.
10. ReadinessPolicy evaluates:
    - CI gates;
    - review gates;
    - draft state;
    - merge conflicts;
    - org-specific blockers;
    - required status mapping back to the source platform.
11. MergePolicy decides whether to auto-merge, wait for human approval, or mark
    ready.
12. Existing cleanup-on-merge behavior tears down runtime/workspace/sandbox
    according to policy.

## Compatibility Strategy

Do not replace existing workspace behavior.

- The existing `workspace` slot remains the code checkout abstraction.
- The first `sandbox-worktree` provider can wrap existing worktree + runtime
  behavior.
- Projects that do not configure `sandbox` keep current AO behavior.

Do not break `ao spawn`.

- `SessionSpawnConfig` remains supported.
- Internally it can be converted to a synthetic `TaskInvocation` later.

Do not replace tracker/scm/notifier.

- Tracker plugins continue to fetch and update issue/task state.
- SCM plugins continue to own PR/CI/review/mergeability.
- Notifier plugins continue to deliver human-visible events.

Do not move platform payloads into core.

- Adapter plugins own raw platform payloads.
- OrgPolicy owns field/status mapping.
- Core consumes normalized task, follow-up, readiness, and policy decisions.

Migrate reactions gradually.

- Existing reactions remain valid.
- New lifecycle middleware should first wrap or reuse reaction behavior.
- CI failure details, review backlog, merge conflicts, and report watcher logic
  can be extracted incrementally from `lifecycle-manager.ts`.

Dashboard compatibility:

- New fields should be optional.
- If `taskContext` is missing, continue deriving display from issue, prompt, PR,
  and existing metadata.

## Test Plan

Unit tests:

- TaskInvocation parsing and validation.
- EventAdapter idempotency key generation.
- Project routing from repo hints, labels, team/project fields, and fallback
  rules.
- OrgPolicy status, field, review, CI, and merge policy decisions.
- SandboxProvider worktree compatibility behavior.
- Sandbox reconnect and ping failure state transitions with mocks.
- Middleware ordering and short-circuit behavior.
- ReadinessPolicy blocker calculation.

Integration tests:

- Linear-like invocation -> route -> spawn -> task metadata persisted.
- GitHub Issue-like invocation -> route -> spawn -> PR detection.
- Follow-up comment while active -> queue -> middleware sends to same session.
- CI failed -> enriched CI message sent once -> retry/escalation behavior
  preserved.
- Human review comments -> enriched review message sent once -> fingerprint
  dedupe preserved.
- Merge conflict -> deterministic dispatch -> cleared when conflict resolves.

End-to-end scenarios:

- Multiple tasks route to different AO projects concurrently.
- Multiple follow-ups on one external thread do not spawn duplicate sessions.
- Remote sandbox failure recreates/reconnects and records recovery metadata.
- PR reaches merge readiness only when policy gates are satisfied.
- Merge cleanup tears down runtime, workspace, and sandbox.

Regression tests:

- Existing `ao spawn --issue` behavior.
- Existing worktree and clone workspace behavior.
- Existing SCM webhook lifecycle refresh.
- Existing dashboard session list and detail rendering.
- Existing reaction configs.

Cross-platform tests:

- Any code touching process spawning, workspace paths, shell commands, or
  sandbox providers must follow `docs/CROSS_PLATFORM.md`.
- New Windows checks must use `isWindows()` from core, not inline
  `process.platform === "win32"`.

## Risks

### Complexity

Adding invocation, queue, sandbox, middleware, and org policy at once would make
the system harder to reason about.

Mitigation:

- Implement in phases:
  1. task model + router;
  2. queue + follow-up routing;
  3. sandbox provider wrapper for current worktree;
  4. lifecycle middleware extraction;
  5. remote sandbox providers.

### State Consistency

Task id, external thread id, session id, sandbox id, branch, and PR id can drift.

Mitigation:

- Define one durable `TaskContext` per delivery session.
- Use idempotency keys.
- Persist sandbox handle and readiness state in session metadata.

### Sandbox Cost and Cleanup

Cloud sandboxes can be expensive or leak if cleanup fails.

Mitigation:

- Add TTL, idle timeout, provider quotas, and cleanup retries.
- Keep worktree provider as default.

### Credential Safety

Remote sandboxes need git and SCM credentials.

Mitigation:

- Introduce `secretProfile`.
- Prefer short-lived credentials and provider-side proxy injection where
  possible.
- Avoid writing long-lived tokens into workspaces or sandbox files.

### Platform Coupling

Feishu, Jira, Linear, GitHub Issues, and OpenClaw have incompatible fields and
status models.

Mitigation:

- Keep raw platform payloads in adapter metadata only.
- Use OrgPolicy field/status mapping.
- Core should not branch on platform-specific fields.

### Concurrent Follow-ups

Multiple follow-ups could race with session creation or active agent delivery.

Mitigation:

- Use deterministic external thread id.
- Use idempotent queue writes.
- Route follow-ups through one session claim/lock.

### Lifecycle Manager Size

`lifecycle-manager.ts` already owns many responsibilities.

Mitigation:

- Extract behavior behind middleware interfaces gradually.
- Preserve existing tests and add focused tests for each extracted unit.

## Recommended Next Discussion

The next design discussion should decide the first implementation phase. The
lowest-risk starting point is:

1. add `TaskInvocation` and `TaskContext`;
2. add a local/in-memory or file-backed `TaskQueue` abstraction;
3. add a project router that maps invocation repo hints to existing AO projects;
4. keep sandbox as current worktree behavior until the invocation path is stable.

This gives AO a platform-neutral task ingress without disturbing existing
workspace, runtime, SCM, lifecycle, and dashboard behavior.
