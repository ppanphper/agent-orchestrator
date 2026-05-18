"use client";

import { ThemeProvider } from "next-themes";
import { MuxProvider } from "@/providers/MuxProvider";
import { I18nProvider } from "@/lib/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <I18nProvider locale="zh-CN">
        <MuxProvider>{children}</MuxProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
