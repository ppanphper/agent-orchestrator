---
name: ao-service-restart
description: Safely diagnose and restart Agent Orchestrator dashboard, daemon, running.json, and lifecycle supervisor state without accidentally killing project sessions.
trigger: Use when a user asks to restart AO, restart the dashboard, restart services, fix stale running.json, fix lifecycle polling, or diagnose sessions stuck because PR state did not sync.
---

# AO Service Restart

Use this skill before touching AO processes for any restart, service-health, stale
dashboard, stale PR state, or missing `running.json` task.

Read `docs/AO_SERVICE_RESTART.md` first. The short version is below.

## Golden Rule

Do not use project/session stop commands as service restart commands.

- `ao stop <project>` kills that project's active sessions and does not restart
  the dashboard or parent daemon.
- `ao stop` kills active sessions across all projects, then stops the parent
  daemon/dashboard.
- Ctrl+C or SIGTERM to the long-running `ao start` parent triggers the full
  shutdown handler and can kill active sessions.

Never run any of those for a dashboard/service restart unless there are no active
sessions or the user explicitly accepts terminating them.

## Required Preflight

Always gather live state before acting:

```bash
ao status
test -f ~/.agent-orchestrator/running.json && cat ~/.agent-orchestrator/running.json
```

On macOS/Linux, when ports or stale children matter:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:14801 -sTCP:LISTEN
```

If `running.json` exists, inspect lifecycle health:

```bash
PID="$(jq -r '.pid' ~/.agent-orchestrator/running.json)"
jq '.metrics, .health' ~/.agent-orchestrator/*-observability/processes/lifecycle-manager-"$PID".json
```

## Decision Tree

1. If active worker sessions exist:
   - Do not restart AO with current CLI commands.
   - Explain that current restart paths kill sessions.
   - Offer a safer code change or ask for explicit approval to stop sessions.

2. If no active sessions exist and a full restart is acceptable:
   - Run `ao stop`.
   - Run `ao start <project-id-or-path>`.
   - Verify using the checklist below.

3. If `running.json` is missing but AO dashboard children are occupying ports:
   - Confirm no active sessions with `ao status`.
   - Prefer `ao start --reap-orphans <project-id-or-path>`.
   - If that cannot clean up, kill only verified AO dashboard child processes
     (`next-server`, `start-all.js`, `direct-terminal-ws.js`) and then run
     `ao start <project-id-or-path>`.

4. If PR state is stale:
   - Remember the dashboard reads session metadata written by lifecycle polling.
   - Restarting only a dashboard child will not refresh PR state.
   - If sessions are terminal, lifecycle may skip them; verify PR truth with the
     SCM before any manual metadata repair, and ask the user before editing.

## Verification Checklist

A restart is not done until all are true:

- `~/.agent-orchestrator/running.json` exists and points at a live `ao start` PID.
- `curl -fsS http://localhost:3000/ -o /dev/null` succeeds.
- Lifecycle health shows fresh successful `lifecycle_poll`.
- `ao status` reflects the expected active and terminated session counts.
- If the issue was stale PR state, `/api/sessions` or the dashboard now shows
  the expected PR/open/review counts.

## Future Implementation Guidance

A dashboard "Restart AO service" button must call a dedicated service operation.
It must not shell out to `ao stop`, `ao stop <project>`, or SIGTERM the parent
daemon without checking active sessions and warning the user.
