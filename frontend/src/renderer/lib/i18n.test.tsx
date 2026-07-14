import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { I18nProvider, localeStorageKey, useI18n } from "./i18n";
import { LanguageSection } from "../components/LanguageSection";

function Harness() {
	const { locale, setLocale, t } = useI18n();
	return (
		<>
			<p>{t("Global settings")}</p>
			<p>{t("Unknown future copy")}</p>
			<button type="button" onClick={() => setLocale(locale === "en" ? "zh-CN" : "en")}>
				change
			</button>
		</>
	);
}

describe("I18nProvider", () => {
	beforeEach(() => window.localStorage.clear());

	it("switches locale, persists it, and keeps English fallback copy", async () => {
		window.localStorage.setItem(localeStorageKey, "en");
		render(
			<I18nProvider>
				<Harness />
			</I18nProvider>,
		);

		await userEvent.click(screen.getByRole("button", { name: "change" }));
		expect(screen.getByText("全局设置")).toBeInTheDocument();
		expect(screen.getByText("Unknown future copy")).toBeInTheDocument();
		await waitFor(() => expect(window.localStorage.getItem(localeStorageKey)).toBe("zh-CN"));
		expect(document.documentElement.lang).toBe("zh-CN");
	});

	it("restores a stored locale", () => {
		window.localStorage.setItem(localeStorageKey, "zh-CN");
		render(
			<I18nProvider>
				<Harness />
			</I18nProvider>,
		);
		expect(screen.getByText("全局设置")).toBeInTheDocument();
	});

	it("changes language through the settings control", async () => {
		window.localStorage.setItem(localeStorageKey, "en");
		render(
			<I18nProvider>
				<LanguageSection />
			</I18nProvider>,
		);

		await userEvent.click(screen.getByRole("combobox", { name: "Language" }));
		await userEvent.click(screen.getByRole("option", { name: "Simplified Chinese" }));

		expect(screen.getByRole("combobox", { name: "语言" })).toHaveTextContent("简体中文");
		await waitFor(() => expect(window.localStorage.getItem(localeStorageKey)).toBe("zh-CN"));
	});
});
