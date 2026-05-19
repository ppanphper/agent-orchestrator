import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a {...props}>{children}</a>
  ),
}));

import NotFound from "./not-found";

describe("NotFound (global)", () => {
  it("renders the page-not-found message", () => {
    render(<NotFound />);
    expect(screen.getByText("页面不存在")).toBeInTheDocument();
  });

  it("renders descriptive copy", () => {
    render(<NotFound />);
    expect(
      screen.getByText("控制台中没有这个路由。请返回主视图选择一个活跃项目或会话。"),
    ).toBeInTheDocument();
  });

  it("renders a link back to the dashboard", () => {
    render(<NotFound />);
    const link = screen.getByText("返回控制台");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/");
  });

  it("renders the not-found icon", () => {
    const { container } = render(<NotFound />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});
