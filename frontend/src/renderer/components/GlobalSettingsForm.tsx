import { DashboardSubhead } from "./DashboardSubhead";
import { MigrationSection } from "./MigrationSection";
import { UpdatesSection } from "./UpdatesSection";
import { LanguageSection } from "./LanguageSection";
import { useI18n } from "../lib/i18n";

// App-wide settings, shown from the sidebar when no project is selected. Each
// section is a self-contained card: Updates (auto-update channel, #2207) and
// Migration (re-run the legacy-AO import, #2205). Connect Mobile lives in the
// sidebar Settings menu, not here.
export function GlobalSettingsForm() {
	const { t } = useI18n();
	return (
		<div className="flex h-full min-h-0 flex-col bg-background text-foreground">
			<DashboardSubhead title={t("Global settings")} subtitle={t("Settings that apply across all projects")} />
			<div className="min-h-0 flex-1 overflow-y-auto p-4.5">
				<div className="mx-auto flex max-w-2xl flex-col gap-4">
					<LanguageSection />
					<UpdatesSection />
					<MigrationSection />
				</div>
			</div>
		</div>
	);
}
