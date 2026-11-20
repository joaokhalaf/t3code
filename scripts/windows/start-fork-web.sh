#!/usr/bin/env bash
set -euo pipefail
repository=${1:?Repository path required}
port=${2:?Web port required}
export T3CODE_PORT=${3:?Backend port required}
action=${4:-start}
if [[ "$action" == release ]]; then
    # Prints the stable release under the fork's own commits; fails if upstream work past that release is included.
    cd "$repository"
    release=$(git describe --tags --abbrev=0 --match 'v*' --exclude '*-*')
    git rev-parse --verify --quiet upstream/main >/dev/null || { echo "No upstream remote; run scripts/parade-sync.sh once." >&2; exit 1; }
    upstream_after=$(( $(git rev-list --count "$release..HEAD") - $(git rev-list --count "$release..HEAD" ^upstream/main) ))
    if [[ "$upstream_after" -gt 0 ]]; then
        echo "The clone includes $upstream_after upstream commit(s) after $release; check out the parade branch synced by scripts/parade-sync.sh." >&2
        exit 1
    fi
    echo "$release"
    exit 0
fi
cd "$repository/apps/web"
export PATH="$HOME/.local/share/vite-plus/bin:$HOME/.local/bin:/home/linuxbrew/.linuxbrew/bin:$PATH"
export T3CODE_SINGLE_ORIGIN_DEV=1
export HOST=127.0.0.1
export PORT="$port"
unset VITE_HTTP_URL VITE_WS_URL VITE_DEV_SERVER_URL
node_binary=$(vp env which node)
vite_entry=$("$node_binary" -e 'const {createRequire}=require("node:module");const p=require("node:path");const q=createRequire(require.resolve("vite-plus"));console.log(p.resolve(p.dirname(q.resolve("vite")),"../bin/vite.js"));')
pid_file="$repository/.t3/windows-frontend-$port.pid"
if [[ "$action" == stop ]]; then
    [[ -f "$pid_file" ]] || exit 0
    read -r frontend_pid < "$pid_file"
    [[ "$frontend_pid" =~ ^[0-9]+$ ]] || exit 1
    if [[ -d "/proc/$frontend_pid" ]]; then
        [[ "$(readlink "/proc/$frontend_pid/cwd")" == "$repository/apps/web" ]] || exit 1
        mapfile -d '' -t command_args < "/proc/$frontend_pid/cmdline"
        [[ "${command_args[1]:-}" == "$vite_entry" && "${command_args[6]:-}" == "$port" ]] || exit 1
        kill -TERM "$frontend_pid"
    fi
    rm -f "$pid_file"
    exit 0
fi
[[ "$action" == start ]] || exit 1
# The installed backend keeps state in ~/.t3/dev when it serves a dev interface; point it at the official history.
state="$HOME/.t3"
if [[ "$(readlink "$state/dev" || true)" != "$state/userdata" ]]; then
    [[ -d "$state/userdata" ]] || { echo "No T3 Code history at $state/userdata; open T3 Code once first." >&2; exit 1; }
    if [[ -e "$state/dev" || -L "$state/dev" ]]; then
        mv "$state/dev" "$state/dev.before-parade-$(date +%Y%m%d-%H%M%S)"
    fi
    ln -s "$state/userdata" "$state/dev"
fi
mkdir -p "$repository/.t3"
printf '%s\n' "$$" > "$pid_file"
exec "$node_binary" "$vite_entry" dev --host 127.0.0.1 --port "$port" --strictPort
