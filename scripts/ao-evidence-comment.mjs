#!/usr/bin/env node

import { existsSync } from "node:fs";
import { readFile, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { URL, fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { createInterface } from "node:readline/promises";

const DEFAULT_PROFILE_DIR = join(homedir(), ".agent-orchestrator", "github-browser-profile");
const DEFAULT_GITHUB_URL = "https://github.com";
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_TITLE = "AO Validation Evidence";

function usage(exitCode = 0) {
  const text = `
Usage:
  node scripts/ao-evidence-comment.mjs login [options]
  node scripts/ao-evidence-comment.mjs comment --pr <url-or-number> [options]

Commands:
  login
    Opens GitHub in a persistent Playwright browser profile. Log in once with a bot
    account; later comment runs reuse the same browser profile.

  comment
    Opens a PR page, fills a Markdown validation comment, uploads screenshots
    through GitHub's web attachment UI, and submits the comment.

Options:
  --profile <dir>          Browser profile directory.
                           Default: ${DEFAULT_PROFILE_DIR}
  --github-url <url>       GitHub base URL. Default: ${DEFAULT_GITHUB_URL}
  --headless               Run Chromium headless.
  --timeout-ms <ms>        Navigation/action timeout. Default: ${DEFAULT_TIMEOUT_MS}

comment options:
  --pr <url-or-number>     PR URL or PR number.
  --repo <owner/repo>      Required when --pr is a number.
  --body <markdown>        Markdown body text.
  --body-file <path>       Markdown body file.
  --image <path>           Screenshot/image file to upload. Can be repeated.
  --title <text>           Comment heading. Default: ${DEFAULT_TITLE}
  --no-submit              Leave the composed comment open instead of clicking Comment.

Examples:
  node scripts/ao-evidence-comment.mjs login
  node scripts/ao-evidence-comment.mjs comment --pr https://github.com/org/repo/pull/123 \\
    --body-file .ao/evidence/pr-123/result.md \\
    --image .ao/evidence/pr-123/home.png \\
    --image .ao/evidence/pr-123/settings.png
`;

  console.log(text.trim());
  process.exit(exitCode);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") {
    usage(0);
  }

  const options = {
    command,
    profile: DEFAULT_PROFILE_DIR,
    githubUrl: DEFAULT_GITHUB_URL,
    headless: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    pr: null,
    repo: null,
    body: null,
    bodyFile: null,
    images: [],
    title: DEFAULT_TITLE,
    submit: true,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    const next = () => {
      const value = rest[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }
      index += 1;
      return value;
    };

    switch (arg) {
      case "--profile":
        options.profile = next();
        break;
      case "--github-url":
        options.githubUrl = next();
        break;
      case "--headless":
        options.headless = true;
        break;
      case "--timeout-ms":
        options.timeoutMs = Number(next());
        if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
          throw new Error("--timeout-ms must be a positive number");
        }
        break;
      case "--pr":
        options.pr = next();
        break;
      case "--repo":
        options.repo = next();
        break;
      case "--body":
        options.body = next();
        break;
      case "--body-file":
        options.bodyFile = next();
        break;
      case "--image":
        options.images.push(next());
        break;
      case "--title":
        options.title = next();
        break;
      case "--no-submit":
        options.submit = false;
        break;
      case "--help":
      case "-h":
        usage(0);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function findRepoRoot() {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (existsSync(join(dir, "package.json")) && existsSync(join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return process.cwd();
    }
    dir = parent;
  }
}

async function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const repoRoot = findRepoRoot();
  const searchPaths = [process.cwd(), repoRoot, join(repoRoot, "packages", "web")];

  for (const searchPath of searchPaths) {
    try {
      const resolved = require.resolve("playwright", { paths: [searchPath] });
      const mod = await import(pathToFileURL(resolved).href);
      return mod.chromium ? mod : mod.default;
    } catch {
      // Try the next workspace search path.
    }
  }

  throw new Error(
    "Could not find the Playwright package. Run `pnpm install` or install Playwright in the workspace.",
  );
}

function normalizePath(inputPath) {
  return isAbsolute(inputPath) ? inputPath : resolve(process.cwd(), inputPath);
}

async function assertReadableFile(inputPath, label) {
  const absPath = normalizePath(inputPath);
  if (!existsSync(absPath)) {
    throw new Error(`${label} not found: ${absPath}`);
  }
  return realpath(absPath);
}

function parsePrUrl(options) {
  if (!options.pr) {
    throw new Error("comment requires --pr <url-or-number>");
  }

  if (/^\d+$/.test(options.pr)) {
    if (!options.repo || !/^[^/]+\/[^/]+$/.test(options.repo)) {
      throw new Error("--repo <owner/repo> is required when --pr is a number");
    }
    const base = options.githubUrl.replace(/\/+$/, "");
    return `${base}/${options.repo}/pull/${options.pr}`;
  }

  let url;
  try {
    url = new URL(options.pr);
  } catch {
    throw new Error("--pr must be a PR URL or a numeric PR number");
  }

  if (!/\/pull\/\d+(?:\/|$)/.test(url.pathname)) {
    throw new Error(`--pr does not look like a GitHub pull request URL: ${options.pr}`);
  }

  return url.toString();
}

async function buildCommentBody(options) {
  if (options.body && options.bodyFile) {
    throw new Error("Use either --body or --body-file, not both");
  }

  let body = options.body ?? "";
  if (options.bodyFile) {
    const bodyFile = await assertReadableFile(options.bodyFile, "body file");
    body = await readFile(bodyFile, "utf-8");
  }

  const trimmed = body.trim();
  const title = options.title.trim();
  if (!title) {
    return trimmed;
  }

  if (trimmed.startsWith(`# ${title}`) || trimmed.startsWith(`## ${title}`)) {
    return trimmed;
  }

  return [`## ${title}`, "", trimmed || "_No validation summary was provided._"].join("\n");
}

async function openContext(options) {
  const { chromium } = await loadPlaywright();
  const profileDir = normalizePath(options.profile);
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: options.headless,
    viewport: { width: 1440, height: 1100 },
  });
  context.setDefaultTimeout(options.timeoutMs);
  context.setDefaultNavigationTimeout(options.timeoutMs);
  const page = context.pages()[0] ?? (await context.newPage());
  return { context, page, profileDir };
}

async function waitForEnter(message) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    await rl.question(message);
  } finally {
    rl.close();
  }
}

async function runLogin(options) {
  const { context, page, profileDir } = await openContext(options);
  try {
    await page.goto(options.githubUrl, { waitUntil: "domcontentloaded" });
    console.log(`GitHub browser profile: ${profileDir}`);
    console.log("Log in with the bot account in the opened browser window.");
    await waitForEnter("Press Enter here after GitHub shows the logged-in account...");
  } finally {
    await context.close();
  }
  console.log("Login state saved.");
}

async function findCommentBox(page) {
  const selectors = [
    'textarea[name="comment[body]"]',
    "textarea#new_comment_field",
    'textarea[placeholder*="Leave a comment"]',
    'textarea[aria-label*="Comment body"]',
    'textarea[aria-label*="Add a comment"]',
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    if (count > 0) {
      const candidate = locator.nth(count - 1);
      try {
        await candidate.scrollIntoViewIfNeeded();
        await candidate.waitFor({ state: "visible", timeout: 5_000 });
        return candidate;
      } catch {
        // Try the next selector.
      }
    }
  }

  throw new Error("Could not find the GitHub PR comment textarea. Are you logged in?");
}

async function findAttachmentInput(page) {
  const selectors = [
    'input[type="file"][accept*="image"]',
    'input[type="file"][multiple]',
    'input[type="file"]',
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    if (count > 0) {
      return locator.nth(count - 1);
    }
  }

  throw new Error("Could not find GitHub's file attachment input on the PR page.");
}

async function waitForAttachmentMarkdown(commentBox, beforeValue, imagePaths, timeoutMs) {
  const basenames = imagePaths.map((imagePath) => basename(imagePath).toLowerCase());
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const value = await commentBox.inputValue();
    const lowerValue = value.toLowerCase();
    const changed = value.length > beforeValue.length;
    const hasAttachmentUrl =
      lowerValue.includes("github.com/user-attachments/assets") ||
      lowerValue.includes("user-images.githubusercontent.com") ||
      lowerValue.includes("private-user-images.githubusercontent.com");
    const hasBasename = basenames.some((name) => lowerValue.includes(name));
    const stillUploading = lowerValue.includes("uploading");

    if (changed && !stillUploading && (hasAttachmentUrl || hasBasename)) {
      return value;
    }

    await delay(500);
  }

  throw new Error("Timed out waiting for GitHub to insert uploaded image Markdown.");
}

async function clickCommentButton(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const candidates = [
    () => page.getByRole("button", { name: /^Comment$/ }).last(),
    () => page.getByRole("button", { name: /comment/i }).last(),
    () => page.locator('button[type="submit"]').last(),
  ];

  while (Date.now() < deadline) {
    for (const candidateFactory of candidates) {
      const candidate = candidateFactory();
      try {
        await candidate.waitFor({ state: "visible", timeout: 1_000 });
        if (await candidate.isEnabled()) {
          await candidate.click();
          return;
        }
      } catch {
        // Try the next candidate.
      }
    }
    await delay(500);
  }

  throw new Error("Could not find an enabled GitHub Comment button.");
}

async function runComment(options) {
  const prUrl = parsePrUrl(options);
  const body = await buildCommentBody(options);
  const imagePaths = [];
  for (const image of options.images) {
    imagePaths.push(await assertReadableFile(image, "image"));
  }

  if (!body && imagePaths.length === 0) {
    throw new Error("comment requires --body, --body-file, or at least one --image");
  }

  const { context, page, profileDir } = await openContext(options);
  try {
    console.log(`Using GitHub browser profile: ${profileDir}`);
    console.log(`Opening PR: ${prUrl}`);
    await page.goto(prUrl, { waitUntil: "domcontentloaded" });

    if (/\/login(?:\?|$)/.test(page.url())) {
      throw new Error(
        `GitHub redirected to login. Run \`node scripts/ao-evidence-comment.mjs login --profile "${profileDir}"\` first.`,
      );
    }

    const commentBox = await findCommentBox(page);
    await commentBox.fill(body);

    if (imagePaths.length > 0) {
      console.log(`Uploading ${imagePaths.length} image(s) through GitHub's comment UI...`);
      const beforeValue = await commentBox.inputValue();
      const input = await findAttachmentInput(page);
      await input.setInputFiles(imagePaths);
      await waitForAttachmentMarkdown(commentBox, beforeValue, imagePaths, options.timeoutMs);
    }

    if (!options.submit) {
      console.log("Comment was composed but not submitted (--no-submit).");
      await waitForEnter("Inspect the browser, then press Enter to close...");
      return;
    }

    await clickCommentButton(page, options.timeoutMs);
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    console.log("Evidence comment submitted.");
  } finally {
    await context.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.command === "login") {
    await runLogin(options);
    return;
  }

  if (options.command === "comment") {
    await runComment(options);
    return;
  }

  throw new Error(`Unknown command: ${options.command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
