import { type NextRequest, NextResponse } from "next/server";
import {
  claimBacklogNow,
  getBacklogIssues,
  getBacklogPollerStatus,
  resumeBacklogPoller,
  setBacklogMaxConcurrent,
  stopBacklogPoller,
} from "@/lib/services";

export const dynamic = "force-dynamic";

/**
 * GET /api/backlog — List backlog issues (labeled agent:backlog)
 */
export async function GET() {
  try {
    const issues = await getBacklogIssues();
    return NextResponse.json({ issues, poller: getBacklogPollerStatus() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch backlog" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/backlog — Control the backlog poller.
 * Body: { action: "start" | "stop" | "status" | "claim-now" | "set-max-concurrent" }
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    maxConcurrent?: number;
  };
  const action = body.action ?? "status";

  if (action === "stop") {
    return NextResponse.json({ poller: stopBacklogPoller() });
  }

  if (action === "start") {
    return NextResponse.json({ poller: resumeBacklogPoller() });
  }

  if (action === "status") {
    return NextResponse.json({ poller: getBacklogPollerStatus() });
  }

  if (action === "claim-now") {
    await claimBacklogNow();
    const issues = await getBacklogIssues();
    return NextResponse.json({ issues, poller: getBacklogPollerStatus() });
  }

  if (action === "set-max-concurrent") {
    if (
      typeof body.maxConcurrent !== "number" ||
      !Number.isInteger(body.maxConcurrent) ||
      body.maxConcurrent < 1 ||
      body.maxConcurrent > 50
    ) {
      return NextResponse.json(
        { error: "maxConcurrent must be an integer between 1 and 50" },
        { status: 400 },
      );
    }
    return NextResponse.json({ poller: setBacklogMaxConcurrent(body.maxConcurrent) });
  }

  return NextResponse.json({ error: `Unsupported backlog action: ${action}` }, { status: 400 });
}
