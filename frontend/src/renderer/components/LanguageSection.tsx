import { Languages } from "lucide-react";
import { useI18n, type Locale } from "../lib/i18n";
import { SettingsOptionMenu, type SettingsOption } from "./settings/SettingsOptionMenu";
import { SettingsRow } from "./settings/SettingsRow";
import { SettingsSection } from "./settings/SettingsSection";

export function LanguageSection() {
	const { locale, setLocale, t } = useI18n();
	const options = [
		{ value: "en", label: t("English") },
		{ value: "zh-CN", label: t("Simplified Chinese") },
	] satisfies SettingsOption<Locale>[];

	return (
		<SettingsSection title={t("Language")}>
			<SettingsRow icon={Languages} label={t("Language")}>
				<SettingsOptionMenu
					aria-label={t("Language")}
					value={locale}
					options={options}
					onChange={(value) => setLocale(value)}
				/>
			</SettingsRow>
		</SettingsSection>
	);
}
