import { Monitor, Moon, Palette, Smartphone, Sun } from "lucide-react";
import type { ThemePreference } from "../../lib/theme";
import { useUiStore } from "../../stores/ui-store";
import { useI18n } from "../../lib/i18n";
import { SettingsOptionMenu, type SettingsOption } from "./SettingsOptionMenu";
import { SettingsLinkRow, SettingsRow } from "./SettingsRow";
import { SettingsSection } from "./SettingsSection";

const THEME_OPTIONS = [
	{ value: "light", label: "Light", icon: <Sun className="size-icon-lg" aria-hidden="true" /> },
	{ value: "dark", label: "Dark", icon: <Moon className="size-icon-lg" aria-hidden="true" /> },
	{ value: "system", label: "System", icon: <Monitor className="size-icon-lg" aria-hidden="true" /> },
] satisfies SettingsOption<ThemePreference>[];

export function GeneralSettingsSection({ onConnectMobile }: { onConnectMobile: () => void }) {
	const { t } = useI18n();
	const themePreference = useUiStore((state) => state.themePreference);
	const setThemePreference = useUiStore((state) => state.setThemePreference);
	const themeOptions = THEME_OPTIONS.map((option) => ({ ...option, label: t(option.label) }));

	return (
		<SettingsSection title={t("General")}>
			<SettingsRow icon={Palette} label={t("Theme")}>
				<SettingsOptionMenu
					aria-label={t("Theme")}
					value={themePreference}
					options={themeOptions}
					onChange={setThemePreference}
				/>
			</SettingsRow>
			<SettingsLinkRow icon={Smartphone} label={t("Connect Mobile")} onClick={onConnectMobile} />
		</SettingsSection>
	);
}
