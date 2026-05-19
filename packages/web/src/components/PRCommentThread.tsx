"use client";

import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";
import type { DashboardPR } from "@/lib/types";
import { cleanBugbotComment } from "./session-detail-utils";

type UnresolvedComment = DashboardPR["unresolvedComments"][number];

interface PRCommentThreadProps {
  comments: UnresolvedComment[];
  unresolvedThreads: number;
  sendingUrls: Set<string>;
  sentUrls: Set<string>;
  errorUrls: Set<string>;
  onAskAgentToFix: (comment: UnresolvedComment) => void;
}

export function PRCommentThread({
  comments,
  unresolvedThreads,
  sendingUrls,
  sentUrls,
  errorUrls,
  onAskAgentToFix,
}: PRCommentThreadProps) {
  const { t } = useI18n();
  if (comments.length === 0) return null;

  return (
    <details className="session-detail-comments-strip">
      <summary>
        <div className="session-detail-comments-strip__toggle">
          <svg
            className="session-detail-comments-strip__chevron"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
          <span className="session-detail-comments-strip__label">
            {t("session.unresolvedComments")}
          </span>
          <span className="session-detail-comments-strip__count">{unresolvedThreads}</span>
          <span className="session-detail-comments-strip__hint">{t("session.clickToExpand")}</span>
        </div>
      </summary>
      <div className="session-detail-comments-strip__body">
        {comments.map((comment, index) => {
          const { title, description } = cleanBugbotComment(comment.body);
          const isSending = sendingUrls.has(comment.url);
          const isSent = sentUrls.has(comment.url);
          const isError = errorUrls.has(comment.url);
          return (
            <details key={comment.url} className="session-detail-comment" open={index === 0}>
              <summary>
                <div className="session-detail-comment__row">
                  <svg
                    className="session-detail-comment__chevron"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="session-detail-comment__title">{title}</span>
                  <span className="session-detail-comment__author">· {comment.author}</span>
                  <a
                    href={comment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="session-detail-comment__view"
                  >
                    {t("session.viewArrow")}
                  </a>
                </div>
              </summary>
              <div className="session-detail-comment__body">
                <div className="session-detail-comment__file">{comment.path}</div>
                <p className="session-detail-comment__text">{description}</p>
                <button
                  onClick={() => onAskAgentToFix(comment)}
                  disabled={isSending}
                  className={cn(
                    "session-detail-comment__fix-btn",
                    isSent && "session-detail-comment__fix-btn--sent",
                    isError && "session-detail-comment__fix-btn--error",
                  )}
                >
                  {isSending
                    ? t("session.sending")
                    : isSent
                      ? t("session.sentCheck")
                      : isError
                        ? t("session.failed")
                        : t("session.askAgentToFix")}
                </button>
              </div>
            </details>
          );
        })}
      </div>
    </details>
  );
}
