import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const errorDisplaySpy = vi.fn();

vi.mock("@/components/ErrorDisplay", () => ({
  ErrorDisplay: (props: {
    title: string;
    message: string;
    primaryAction?: { label: string; onClick?: () => void };
    secondaryAction?: { label: string; onClick?: () => void };
  }) => {
    errorDisplaySpy(props);
    return (
      <div>
        <div>{props.title}</div>
        <div>{props.message}</div>
        {props.primaryAction ? (
          <button type="button" onClick={props.primaryAction.onClick}>
            {props.primaryAction.label}
          </button>
        ) : null}
        {props.secondaryAction ? (
          <button type="button" onClick={props.secondaryAction.onClick}>
            {props.secondaryAction.label}
          </button>
        ) : null}
      </div>
    );
  },
}));

import GlobalError from "./global-error";

describe("Global error boundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    errorDisplaySpy.mockClear();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload: vi.fn() },
    });
  });

  it("calls reset when retrying", () => {
    const reset = vi.fn();

    render(<GlobalError error={new Error("layout failed")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("reloads the page on demand", () => {
    render(<GlobalError error={new Error("layout failed")} reset={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "刷新页面" }));
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it("passes the expected shell copy to ErrorDisplay", () => {
    render(<GlobalError error={new Error("layout failed")} reset={vi.fn()} />);

    expect(errorDisplaySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "应用外壳出现错误",
        message: "控制台无法从布局层错误中恢复。请先重试；如果仍失败，再刷新页面。",
      }),
    );
  });
});
