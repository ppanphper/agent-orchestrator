#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
frontend_dir="${repo_root}/frontend"
backend_go_mod="${repo_root}/backend/go.mod"
session_name="${AO_DEV_TMUX_SESSION:-ao-dev}"
run_file="${AO_RUN_FILE:-${HOME}/.ao/dev/running.json}"
vite_url="${AO_DEV_VITE_URL:-http://localhost:5173/}"
startup_timeout="${AO_DEV_START_TIMEOUT:-90}"

usage() {
	cat <<EOF
Usage: ./scripts/ao-dev.sh <command>

Commands:
  start    Start the Electron app and daemon in tmux session ${session_name}
  restart  Restart the managed development session
  stop     Stop the managed development session
  status   Show tmux, daemon, and Vite status
  logs     Attach to the tmux session (detach with Ctrl-b d)
  help     Show this help

Environment overrides:
  AO_DEV_TMUX_SESSION  tmux session name (default: ao-dev)
  AO_DEV_START_TIMEOUT startup wait in seconds (default: 90)
  AO_DEV_VITE_URL      Vite readiness URL (default: http://localhost:5173/)
  AO_RUN_FILE          daemon run file (default: ~/.ao/dev/running.json)
EOF
}

require_command() {
	if ! command -v "$1" >/dev/null 2>&1; then
		printf 'Required command not found: %s\n' "$1" >&2
		exit 1
	fi
}

version_at_least() {
	local actual="$1"
	local required="$2"
	local actual_major actual_minor actual_patch
	local required_major required_minor required_patch

	IFS=. read -r actual_major actual_minor actual_patch <<<"${actual}"
	IFS=. read -r required_major required_minor required_patch <<<"${required}"
	actual_patch="${actual_patch:-0}"
	required_patch="${required_patch:-0}"

	((actual_major > required_major)) && return 0
	((actual_major < required_major)) && return 1
	((actual_minor > required_minor)) && return 0
	((actual_minor < required_minor)) && return 1
	((actual_patch >= required_patch))
}

go_version() {
	"$1" version 2>/dev/null | awk '{sub(/^go/, "", $3); print $3}'
}

resolve_go() {
	local required actual candidate gopath goos goarch
	required="$(awk '$1 == "go" { print $2; exit }' "${backend_go_mod}")"

	if command -v go >/dev/null 2>&1; then
		candidate="$(command -v go)"
		actual="$(go_version "${candidate}")"
		if [[ -n "${actual}" ]] && version_at_least "${actual}" "${required}"; then
			printf '%s\n' "${candidate}"
			return 0
		fi

		gopath="$(go env GOPATH 2>/dev/null | awk -F: 'NR == 1 { print $1 }')"
		goos="$(go env GOOS 2>/dev/null)"
		goarch="$(go env GOARCH 2>/dev/null)"
		for candidate in "${gopath}"/pkg/mod/golang.org/toolchain@v0.0.1-go*."${goos}-${goarch}"/bin/go; do
			[[ -x "${candidate}" ]] || continue
			actual="$(go_version "${candidate}")"
			if [[ -n "${actual}" ]] && version_at_least "${actual}" "${required}"; then
				printf '%s\n' "${candidate}"
				return 0
			fi
		done
	fi

	printf 'Go %s+ is required. Install it from https://go.dev/dl/.\n' "${required}" >&2
	return 1
}

session_exists() {
	tmux has-session -t "=${session_name}" 2>/dev/null
}

run_file_port() {
	[[ -f "${run_file}" ]] || return 1
	node -e '
		try {
			const value = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
			if (Number.isInteger(value.port) && value.port > 0 && value.port <= 65535) {
				process.stdout.write(String(value.port));
			}
		} catch {}
	' "${run_file}"
}

daemon_ready() {
	local port
	port="$(run_file_port 2>/dev/null || true)"
	[[ -n "${port}" ]] || return 1
	curl --fail --silent --show-error --max-time 1 "http://127.0.0.1:${port}/readyz" >/dev/null 2>&1
}

vite_ready() {
	curl --fail --silent --show-error --max-time 1 "${vite_url}" >/dev/null 2>&1
}

show_status() {
	local failed=0 port

	if session_exists; then
		printf 'tmux:   running (%s)\n' "${session_name}"
	else
		printf 'tmux:   stopped (%s)\n' "${session_name}"
		failed=1
	fi

	port="$(run_file_port 2>/dev/null || true)"
	if daemon_ready; then
		printf 'daemon: ready (http://127.0.0.1:%s/readyz)\n' "${port}"
	else
		printf 'daemon: not ready\n'
		failed=1
	fi

	if vite_ready; then
		printf 'Vite:   ready (%s)\n' "${vite_url}"
	else
		printf 'Vite:   not ready (%s)\n' "${vite_url}"
		failed=1
	fi

	return "${failed}"
}

run_dev() {
	local go_binary
	require_command npm
	go_binary="$(resolve_go)"
	export PATH="$(dirname "${go_binary}"):${PATH}"
	cd "${frontend_dir}"
	exec npm run dev
}

start_service() {
	local elapsed=0
	require_command tmux
	require_command npm
	require_command node
	require_command curl
	resolve_go >/dev/null

	if session_exists; then
		printf 'Development session %s is already running.\n' "${session_name}"
		show_status || true
		return 0
	fi

	printf 'Starting AO development services in tmux session %s...\n' "${session_name}"
	tmux new-session -d -s "${session_name}" -c "${frontend_dir}" "exec ../scripts/ao-dev.sh _run"

	while ((elapsed < startup_timeout)); do
		if ! session_exists; then
			printf 'Development session exited during startup. Recent output:\n' >&2
			tmux capture-pane -p -t "=${session_name}" -S -80 2>/dev/null || true
			return 1
		fi
		if daemon_ready && vite_ready; then
			printf 'AO development services are ready.\n'
			show_status
			return 0
		fi
		sleep 1
		((elapsed += 1))
	done

	printf 'Timed out after %s seconds waiting for startup. Run "%s logs" for details.\n' \
		"${startup_timeout}" "$0" >&2
	return 1
}

stop_service() {
	local elapsed=0
	require_command tmux

	if ! session_exists; then
		printf 'Development session %s is already stopped.\n' "${session_name}"
		return 0
	fi

	printf 'Stopping AO development services in tmux session %s...\n' "${session_name}"
	tmux send-keys -t "${session_name}:0.0" C-c
	while ((elapsed < 10)); do
		if ! session_exists; then
			printf 'AO development services stopped.\n'
			return 0
		fi
		sleep 1
		((elapsed += 1))
	done

	tmux kill-session -t "=${session_name}"
	printf 'AO development services stopped.\n'
}

show_logs() {
	require_command tmux
	if ! session_exists; then
		printf 'Development session %s is not running.\n' "${session_name}" >&2
		return 1
	fi
	if [[ -n "${TMUX:-}" ]]; then
		exec tmux switch-client -t "=${session_name}"
	fi
	exec tmux attach-session -t "=${session_name}"
}

command="${1:-help}"
case "${command}" in
	start)
		start_service
		;;
	restart)
		stop_service
		start_service
		;;
	stop)
		stop_service
		;;
	status)
		require_command tmux
		require_command node
		require_command curl
		show_status
		;;
	logs)
		show_logs
		;;
	help | --help | -h)
		usage
		;;
	_run)
		run_dev
		;;
	*)
		printf 'Unknown command: %s\n\n' "${command}" >&2
		usage >&2
		exit 2
		;;
esac
