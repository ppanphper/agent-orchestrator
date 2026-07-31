import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Keyboard, Mail } from "lucide-react";
import { ConnectMobileModal } from "./ConnectMobileModal";
import { LanguageSection } from "./LanguageSection";
import { DeveloperModeSection } from "./settings/DeveloperModeSection";
import { GeneralSettingsSection } from "./settings/GeneralSettingsSection";
import { ReportProblemDialog } from "./settings/ReportProblemDialog";
import { SettingsLinkRow } from "./settings/SettingsRow";
import { SettingsPageShell } from "./settings/SettingsPageShell";
import { SettingsPanel } from "./settings/SettingsPanel";
import { SettingsSection } from "./settings/SettingsSection";
import { UpdatesSection } from "./settings/UpdatesSection";
import { useI18n } from "../lib/i18n";
import { KeyboardShortcutsSettingsDialog } from "./settings/KeyboardShortcutsSettingsDialog";

export function GlobalSettingsForm() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [mobileOpen, setMobileOpen] = useState(false);
	const [reportProblemOpen, setReportProblemOpen] = useState(false);
	const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false);

	return (
		<>
			<SettingsPageShell>
				<SettingsPanel onClose={() => navigate({ to: "/" })}>
					<GeneralSettingsSection onConnectMobile={() => setMobileOpen(true)} />
					<LanguageSection />
					<SettingsSection title={t("Preferences")}>
						<SettingsLinkRow
							icon={Keyboard}
							label={t("Keyboard shortcuts")}
							onClick={() => setKeyboardShortcutsOpen(true)}
						/>
					</SettingsSection>
					<UpdatesSection />
					<DeveloperModeSection />
					<SettingsSection title={t("Get help")}>
						<SettingsLinkRow icon={Mail} label={t("Report a problem")} onClick={() => setReportProblemOpen(true)} />
					</SettingsSection>
				</SettingsPanel>
			</SettingsPageShell>
			<ConnectMobileModal open={mobileOpen} onOpenChange={setMobileOpen} />
			<ReportProblemDialog open={reportProblemOpen} onOpenChange={setReportProblemOpen} />
			<KeyboardShortcutsSettingsDialog
				open={keyboardShortcutsOpen}
				onOpenChange={setKeyboardShortcutsOpen}
			/>
		</>
	);
}
