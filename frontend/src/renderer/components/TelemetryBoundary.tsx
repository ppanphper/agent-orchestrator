import React from "react";
import { captureRendererException } from "../lib/telemetry";
import { useI18n } from "../lib/i18n";

type Props = {
	children: React.ReactNode;
};

type State = {
	hasError: boolean;
};

export class TelemetryBoundary extends React.Component<Props, State> {
	state: State = { hasError: false };

	static getDerivedStateFromError() {
		return { hasError: true };
	}

	componentDidCatch(error: Error, info: React.ErrorInfo) {
		void captureRendererException(error, {
			source: "react-error-boundary",
			operation: "react_render",
		});
		void info;
	}

	render() {
		if (this.state.hasError) {
			return <TelemetryFallback />;
		}
		return this.props.children;
	}
}

function TelemetryFallback() {
	const { t } = useI18n();
	return (
		<div className="flex h-screen items-center justify-center bg-background px-6 text-center text-foreground">
			<div>
				<h1 className="text-heading-sm font-semibold">{t("The app hit an unexpected error.")}</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					{t("Restart the app or check the daemon logs if this keeps happening.")}
				</p>
			</div>
		</div>
	);
}
