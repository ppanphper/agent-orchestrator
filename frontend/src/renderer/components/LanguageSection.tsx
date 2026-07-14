import { Languages } from "lucide-react";
import { useI18n, type Locale } from "../lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export function LanguageSection() {
	const { locale, setLocale, t } = useI18n();

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-control">
					<Languages className="size-icon-md text-muted-foreground" aria-hidden="true" />
					{t("Language")}
				</CardTitle>
			</CardHeader>
			<CardContent className="flex items-center justify-between gap-4">
				<div className="min-w-0">
					<Label htmlFor="app-language">{t("Language")}</Label>
					<p className="mt-1 text-caption text-muted-foreground">
						{t("Choose the language used throughout Agent Orchestrator.")}
					</p>
				</div>
				<Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
					<SelectTrigger id="app-language" className="w-44" aria-label={t("Language")}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="en">{t("English")}</SelectItem>
						<SelectItem value="zh-CN">{t("Simplified Chinese")}</SelectItem>
					</SelectContent>
				</Select>
			</CardContent>
		</Card>
	);
}
