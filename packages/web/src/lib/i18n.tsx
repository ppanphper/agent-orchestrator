"use client";

import { createContext, useContext, useMemo } from "react";

export type Locale = "en" | "zh-CN";

const en = {
  app: {
    name: "Agent Orchestrator",
    dashboard: "Dashboard",
    allProjects: "All projects",
  },
  common: {
    dismiss: "Dismiss",
    loading: "Loading...",
    retry: "Try again",
    backToDashboard: "Back to dashboard",
  },
  dashboard: {
    title: "Dashboard",
    subtitle: "Live agent sessions, pull requests, and merge status.",
    needAttention: "{count} need attention",
    workingCount: "{count} working",
    loadFailed: "Orchestrator failed to load",
    loadHint:
      "Confirm agent-orchestrator.yaml exists and is valid, then run ao doctor for diagnostics.",
    rateLimited:
      "GitHub API rate limited - PR data (CI status, review state, sizes) may be stale. Will retry automatically on next refresh.",
    orchestrator: "Orchestrator",
    spawnOrchestrator: "Spawn Orchestrator",
    spawning: "Spawning...",
    doneTerminated: "Done / Terminated",
    restored: "Session restored",
    terminated: "Session terminated",
    mergeFailed: "Merge failed: {message}",
    merged: "PR #{number} merged",
    mergeNetworkError: "Network error while merging PR",
    sendFailed: "Send failed: {message}",
    sendNetworkError: "Network error while sending message",
    terminateFailed: "Terminate failed: {message}",
    terminateNetworkError: "Network error while terminating session",
    restoreFailed: "Restore failed: {message}",
    restoreNetworkError: "Network error while restoring session",
    spawnFailed: "Failed to spawn orchestrator",
  },
  emptyState: {
    headline: "Ready to orchestrate",
    hint: "Open the main orchestrator to start a session and fan out parallel agents across your codebase.",
    openOrchestrator: "Open Orchestrator",
    ghost: {
      working: "Working",
      pending: "Pending",
      review: "Review",
      respond: "Respond",
      merge: "Merge",
    },
  },
  zones: {
    merge: { label: "Ready", empty: "Nothing cleared to land yet." },
    action: { label: "Action", empty: "No agents need your input." },
    respond: { label: "Respond", empty: "No agents need your input." },
    review: { label: "Review", empty: "No code waiting for review." },
    pending: { label: "Pending", empty: "Nothing blocked." },
    working: { label: "Working", empty: "No agents running." },
    done: { label: "Done", empty: "No completed sessions." },
    viewAll: "View all {count}",
    noMetadata: "No branch or PR metadata",
    openSession: "Open {title}",
    goToSession: "Go to {title}",
    chips: {
      ready: "ready",
      needsInput: "needs input",
      stuck: "stuck",
      errored: "errored",
      waiting: "waiting",
      crashed: "crashed",
      blocked: "blocked",
      ciFailed: "ci failed",
      changes: "changes",
      conflicts: "conflicts",
      action: "action",
      review: "review",
      threads: "threads",
      pending: "pending",
      idle: "idle",
      active: "active",
    },
  },
  projects: {
    heading: "Projects",
    newProject: "New project",
    noneYet: "No projects yet. Click + to add one.",
    renameSession: "Rename session",
    openSession: "Open {title}",
    renameId: "Rename {id}",
    removeProject: "Remove project",
    removing: "Removing...",
    removeConfirm:
      "Remove project {name} from AO? This clears its AO sessions/history and removes it from the portfolio, but keeps the repository folder on disk.",
    configNeedsRepair: "Config needs repair",
    activeSessions: "{count} active session{plural}",
    openPRs: "{count} open PR{plural}",
    openProject: "Open project",
    repairProject: "Repair project",
    configUnresolved: "Project config could not be resolved",
    orchestratorAvailable: "Per-project orchestrator available",
    noOrchestrator: "No running orchestrator",
    orchestratorLink: "orchestrator",
    metrics: {
      merge: "Merge",
      respond: "Respond",
      review: "Review",
      action: "Action",
      pending: "Pending",
      working: "Working",
    },
  },
  done: {
    merged: "merged",
    terminated: "terminated",
    done: "done",
    restore: "Restore",
  },
  session: {
    restore: "restore",
    terminal: "terminal",
    viewCurrentContext: "View current context",
    summary: "Summary",
    issue: "Issue",
    ciChecks: "CI Checks",
    prDetailsLoading: "PR details loading...",
    mergeable: "mergeable",
    review: "review",
    noPr: "No PR associated with this session.",
    prRateLimited: "PR data rate limited",
    agentNotified: "notified",
    sent: "sent!",
    failed: "failed",
    continue: "Continue",
    abort: "Abort",
    skip: "Skip",
    sending: "Sending...",
    sentShort: "Sent",
    replyPlaceholder: "Type a reply... (Enter to send)",
    replyLabel: "Type a reply to the agent",
    mergePr: "Merge PR #{number}",
    confirmTerminate: "Confirm terminate session",
    terminate: "Terminate session",
    killConfirm: "kill?",
  },
  errors: {
    notFoundTitle: "Page not found",
    notFoundMessage:
      "This route does not exist in the dashboard. Return to the main view to pick an active project or session.",
    routeTitle: "Something went wrong",
    routeMessage:
      "The dashboard hit an unexpected error. Try reloading the route data or head back to the main dashboard.",
    globalTitle: "Something broke at the app shell",
    globalMessage:
      "The dashboard could not recover from this error at the layout level. Try again first, then reload the page if it still fails.",
    reloadPage: "Reload page",
  },
} as const;

type WidenStrings<T> = {
  [K in keyof T]: T[K] extends string ? string : WidenStrings<T[K]>;
};

type Dictionary = WidenStrings<typeof en>;

const zhCN: Dictionary = {
  app: {
    name: "Agent Orchestrator",
    dashboard: "控制台",
    allProjects: "全部项目",
  },
  common: {
    dismiss: "关闭",
    loading: "加载中...",
    retry: "重试",
    backToDashboard: "返回控制台",
  },
  dashboard: {
    title: "控制台",
    subtitle: "实时查看 Agent 会话、拉取请求和合并状态。",
    needAttention: "{count} 个需要关注",
    workingCount: "{count} 个运行中",
    loadFailed: "编排器加载失败",
    loadHint: "确认 agent-orchestrator.yaml 存在且有效，然后运行 ao doctor 诊断。",
    rateLimited:
      "GitHub API 已触发限流，PR 数据（CI 状态、评审状态、变更规模）可能不是最新。下次刷新会自动重试。",
    orchestrator: "编排器",
    spawnOrchestrator: "启动编排器",
    spawning: "启动中...",
    doneTerminated: "已完成 / 已终止",
    restored: "会话已恢复",
    terminated: "会话已终止",
    mergeFailed: "合并失败：{message}",
    merged: "PR #{number} 已合并",
    mergeNetworkError: "合并 PR 时发生网络错误",
    sendFailed: "发送失败：{message}",
    sendNetworkError: "发送消息时发生网络错误",
    terminateFailed: "终止失败：{message}",
    terminateNetworkError: "终止会话时发生网络错误",
    restoreFailed: "恢复失败：{message}",
    restoreNetworkError: "恢复会话时发生网络错误",
    spawnFailed: "启动编排器失败",
  },
  emptyState: {
    headline: "准备开始编排",
    hint: "打开主编排器启动会话，并在代码库中并行分发多个 Agent。",
    openOrchestrator: "打开编排器",
    ghost: {
      working: "运行中",
      pending: "等待中",
      review: "待评审",
      respond: "待回复",
      merge: "可合并",
    },
  },
  zones: {
    merge: { label: "可合并", empty: "还没有可以合并的内容。" },
    action: { label: "需处理", empty: "当前没有 Agent 需要输入。" },
    respond: { label: "待回复", empty: "当前没有 Agent 需要输入。" },
    review: { label: "待评审", empty: "没有等待评审的代码。" },
    pending: { label: "等待中", empty: "没有阻塞项。" },
    working: { label: "运行中", empty: "没有正在运行的 Agent。" },
    done: { label: "已完成", empty: "没有已完成的会话。" },
    viewAll: "查看全部 {count} 个",
    noMetadata: "无分支或 PR 元数据",
    openSession: "打开 {title}",
    goToSession: "前往 {title}",
    chips: {
      ready: "就绪",
      needsInput: "需输入",
      stuck: "卡住",
      errored: "出错",
      waiting: "等待",
      crashed: "已崩溃",
      blocked: "阻塞",
      ciFailed: "CI 失败",
      changes: "需修改",
      conflicts: "有冲突",
      action: "需处理",
      review: "评审",
      threads: "评论",
      pending: "等待",
      idle: "空闲",
      active: "活跃",
    },
  },
  projects: {
    heading: "项目",
    newProject: "新建项目",
    noneYet: "还没有项目。点击 + 添加一个。",
    renameSession: "重命名会话",
    openSession: "打开 {title}",
    renameId: "重命名 {id}",
    removeProject: "移除项目",
    removing: "移除中...",
    removeConfirm:
      "从 AO 中移除项目 {name}？这会清除它的 AO 会话和历史记录，并从项目列表中移除，但会保留磁盘上的仓库目录。",
    configNeedsRepair: "配置需要修复",
    activeSessions: "{count} 个活跃会话",
    openPRs: "{count} 个打开的 PR",
    openProject: "打开项目",
    repairProject: "修复项目",
    configUnresolved: "项目配置无法解析",
    orchestratorAvailable: "项目编排器可用",
    noOrchestrator: "没有运行中的编排器",
    orchestratorLink: "编排器",
    metrics: {
      merge: "可合并",
      respond: "待回复",
      review: "待评审",
      action: "需处理",
      pending: "等待中",
      working: "运行中",
    },
  },
  done: {
    merged: "已合并",
    terminated: "已终止",
    done: "已完成",
    restore: "恢复",
  },
  session: {
    restore: "恢复",
    terminal: "终端",
    viewCurrentContext: "查看当前上下文",
    summary: "摘要",
    issue: "议题",
    ciChecks: "CI 检查",
    prDetailsLoading: "PR 详情加载中...",
    mergeable: "可合并",
    review: "评审",
    noPr: "此会话没有关联 PR。",
    prRateLimited: "PR 数据已限流",
    agentNotified: "已通知 Agent",
    sent: "已发送",
    failed: "失败",
    continue: "继续",
    abort: "中止",
    skip: "跳过",
    sending: "发送中...",
    sentShort: "已发送",
    replyPlaceholder: "输入回复...（按 Enter 发送）",
    replyLabel: "给 Agent 的回复",
    mergePr: "合并 PR #{number}",
    confirmTerminate: "确认终止会话",
    terminate: "终止会话",
    killConfirm: "终止？",
  },
  errors: {
    notFoundTitle: "页面不存在",
    notFoundMessage: "控制台中没有这个路由。请返回主视图选择一个活跃项目或会话。",
    routeTitle: "出现错误",
    routeMessage: "控制台遇到意外错误。请重载路由数据，或返回主控制台。",
    globalTitle: "应用外壳出现错误",
    globalMessage: "控制台无法从布局层错误中恢复。请先重试；如果仍失败，再刷新页面。",
    reloadPage: "刷新页面",
  },
};

const dictionaries = {
  en,
  "zh-CN": zhCN,
};

export type TranslationKey = LeafKeys<Dictionary>;
type Vars = Record<string, string | number>;

type LeafKeys<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : LeafKeys<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

function readKey(dictionary: Dictionary, key: TranslationKey): string {
  let value: unknown = dictionary;
  for (const segment of key.split(".")) {
    value = (value as Record<string, unknown>)[segment];
  }
  return typeof value === "string" ? value : key;
}

function formatTemplate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`,
  );
}

interface I18nContextValue {
  locale: Locale;
  t: (key: TranslationKey, vars?: Vars) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  t: (key, vars) => formatTemplate(readKey(en, key), vars),
});

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const dictionary = dictionaries[locale];
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: (key, vars) => formatTemplate(readKey(dictionary, key), vars),
    }),
    [dictionary, locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
