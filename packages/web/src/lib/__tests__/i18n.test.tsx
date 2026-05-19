import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { I18nProvider, useI18n } from "../i18n";

function LocaleProbe() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div>
      <span>{locale}</span>
      <span>{t("dashboard.title")}</span>
      <button type="button" onClick={() => setLocale("en")}>
        English
      </button>
    </div>
  );
}

describe("i18n", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "en";
  });

  it("defaults to Chinese and persists language changes", () => {
    render(
      <I18nProvider locale="zh-CN">
        <LocaleProbe />
      </I18nProvider>,
    );

    expect(screen.getByText("zh-CN")).toBeInTheDocument();
    expect(screen.getByText("控制台")).toBeInTheDocument();
    expect(window.localStorage.getItem("ao:locale")).toBe("zh-CN");
    expect(document.documentElement.lang).toBe("zh-CN");

    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByText("en")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(window.localStorage.getItem("ao:locale")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });
});
