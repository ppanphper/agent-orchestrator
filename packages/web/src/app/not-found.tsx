import { ErrorDisplay } from "@/components/ErrorDisplay";

export default function NotFound() {
  return (
    <ErrorDisplay
      title="页面不存在"
      message="控制台中没有这个路由。请返回主视图选择一个活跃项目或会话。"
      tone="not-found"
      primaryAction={{ label: "返回控制台", href: "/" }}
    />
  );
}
