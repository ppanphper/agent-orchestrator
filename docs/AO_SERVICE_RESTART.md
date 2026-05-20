# AO Service Restart Runbook

This runbook prevents a common operational mistake: using project/session stop
commands as if they were dashboard or service restart commands.

## Restart Layers

AO has three different things people may call "restart":

| Layer                 | What it affects                                                            | Current safe command                                                    |
| --------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Dashboard/web runtime | Next.js dashboard, web API, terminal WebSocket children                    | No dedicated safe CLI command yet                                       |
| AO daemon/supervisor  | Long-lived `ao start` parent, `running.json`, lifecycle project supervisor | No dedicated safe service-only CLI command yet                          |
| Project sessions      | Orchestrator/worker agent sessions and their runtimes                      | `ao stop`, `ao stop <project>`, `ao session kill`, `ao session restore` |

Do not collapse these layers. A dashboard restart should not terminate agent
sessions.

## Command Semantics

- `ao start <project>` starts the dashboard, direct-terminal server, orchestrator
  session, and lifecycle project supervisor. It registers the parent PID in
  `~/.agent-orchestrator/running.json`.
- `ao stop` stops everything and kills active sessions across all projects.
- `ao stop <project>` kills only that project's active sessions. It does not
  stop the dashboard or the parent AO daemon because those serve all projects.
- Ctrl+C or SIGTERM delivered to the long-running `ao start` parent performs the
  full shutdown handler, including killing active sessions and writing
  `last-stop.json`.

Therefore:

- Never use `ao stop <project>` to restart the dashboard or lifecycle supervisor.
- Never use `ao stop` or SIGTERM to the `ao start` parent for a service restart
  unless there are no active sessions, or the user explicitly accepted that
  active sessions will be killed.
- If a future dashboard button is added, it must not be implemented as a wrapper
  around `ao stop`, `ao stop <project>`, or raw SIGTERM to the parent daemon.

## Required Preflight

Before restarting anything, gather live state:

```bash
ao status
test -f ~/.agent-orchestrator/running.json && cat ~/.agent-orchestrator/running.json
```

On macOS/Linux, if the dashboard looks stale or `running.json` is missing:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:14801 -sTCP:LISTEN
```

Also inspect lifecycle health for the currently registered daemon:

```bash
PID="$(jq -r '.pid' ~/.agent-orchestrator/running.json)"
jq '.metrics, .health' ~/.agent-orchestrator/*-observability/processes/lifecycle-manager-"$PID".json
```

If `ao status` shows active worker sessions, stop here unless the user asked to
terminate those sessions. The current CLI does not have a guaranteed
service-only restart path for an active daemon.

## Safe Full Restart When No Active Sessions Exist

Use this only when `ao status` shows no active worker sessions, or the user
explicitly approved terminating them.

```bash
ao stop
ao start <project-id-or-path>
```

Then verify:

```bash
cat ~/.agent-orchestrator/running.json
curl -fsS http://localhost:3000/ -o /dev/null
ao status
```

The restart is not complete until all of these are true:

- `running.json` exists and points at a live `ao start` parent PID.
- The dashboard returns HTTP 200.
- Lifecycle health has a fresh successful `lifecycle_poll`.
- `ao status` matches the expected active/terminated session counts.

## Orphaned Dashboard Repair

Symptom:

- `running.json` is missing or stale.
- Ports such as `3000` or `14801` are occupied by AO child processes.
- The dashboard is unavailable or PR/lifecycle state is stale.

This means the service is not fully running. First confirm there are no active
sessions that would be harmed:

```bash
ao status
```

If there are no active sessions, prefer startup's orphan handling:

```bash
ao start --reap-orphans <project-id-or-path>
```

If startup cannot reap the stale children, kill only verified AO dashboard
children occupying the dashboard ports, then run `ao start <project-id-or-path>`.
On macOS/Linux the relevant children usually match `next-server`, `start-all.js`,
or `direct-terminal-ws.js`; do not kill unrelated processes that merely use the
same ports.

## Stale PR State After a Restart

The dashboard does not independently poll GitHub for PR state. The long-running
`ao start` process runs lifecycle polling and writes PR enrichment into session
metadata. If the lifecycle supervisor was not running, PRs merged on GitHub may
remain displayed as open/review-pending until polling resumes.

If a session has already become terminal before PR enrichment catches up, the
lifecycle supervisor may skip it. Do not silently edit session metadata. First
verify the PR state with the SCM source of truth, then either use an official AO
cleanup/restore path or ask the user before applying a manual metadata repair.

## Future Dashboard Restart Button Requirements

A dashboard restart control should be a dedicated service operation, not a
wrapper around session stop commands.

Minimum requirements:

- Show active session count before allowing restart.
- Refuse or require explicit confirmation when active sessions would be killed.
- Distinguish "restart dashboard children" from "restart AO daemon/supervisor"
  from "stop project sessions".
- Recreate `running.json` and lifecycle project supervisor when repairing a stale
  daemon.
- Wait for dashboard HTTP 200 and fresh lifecycle health before reporting
  success.
- Record the operation in observability/activity events with enough detail to
  audit what was stopped and restarted.
