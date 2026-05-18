import chalk from "chalk";
import type { Command } from "commander";
import { getRunning } from "../lib/running-state.js";

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

export function registerBacklog(program: Command): void {
  program
    .command("backlog [action]")
    .description("Control the backlog poller and list unclaimed backlog issues")
    .option("--json", "Print raw JSON")
    .action(async (action: string | undefined, opts: { json?: boolean }) => {
      const running = await getRunning();
      if (!running) {
        console.error(chalk.red("AO is not running. Start it first with `ao start`."));
        process.exit(1);
      }

      const url = `http://localhost:${running.port}/api/backlog`;
      const normalizedAction = action ?? "list";
      if (!["list", "poll", "claim-now", "start", "stop", "status"].includes(normalizedAction)) {
        console.error(chalk.red(`Unknown backlog action: ${normalizedAction}`));
        console.error(chalk.dim("Use one of: list, claim-now, start, stop, status"));
        process.exit(1);
      }

      const response =
        normalizedAction === "list" || normalizedAction === "poll"
          ? await fetch(url)
          : await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: normalizedAction,
              }),
            });
      const data = (await response.json().catch(() => ({}))) as BacklogResponse;

      if (!response.ok) {
        console.error(chalk.red(data.error ?? `Backlog request failed with ${response.status}`));
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      if (["start", "stop", "status"].includes(normalizedAction)) {
        const status = data.poller;
        if (!status) {
          console.log(chalk.green("Backlog poller updated."));
          return;
        }

        const label = status.paused
          ? chalk.yellow("paused")
          : status.running
            ? chalk.green("running")
            : chalk.dim("stopped");
        console.log(`Backlog poller is ${label}.`);
        return;
      }

      const issues = data.issues ?? [];
      if (issues.length === 0) {
        const suffix = data.poller?.paused ? chalk.yellow(" Poller is paused.") : "";
        const prefix =
          normalizedAction === "claim-now"
            ? "Claim cycle complete. No unclaimed backlog issues remain."
            : "No unclaimed backlog issues.";
        console.log(chalk.green(prefix) + suffix);
        return;
      }

      const heading =
        normalizedAction === "claim-now"
          ? `Claim cycle complete. ${issues.length} unclaimed issue(s):\n`
          : `${issues.length} unclaimed backlog issue(s):\n`;
      console.log(chalk.bold(heading));
      for (const issue of issues) {
        const labels = issue.labels?.length ? chalk.dim(` [${issue.labels.join(", ")}]`) : "";
        console.log(
          `  ${chalk.cyan(issue.projectId)} ${chalk.cyan(`#${issue.id}`)} ${issue.title}${labels}`,
        );
        if (issue.url) console.log(`       ${chalk.dim(issue.url)}`);
      }
    });
}
