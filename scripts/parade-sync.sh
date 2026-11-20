#!/usr/bin/env bash
# Rebase the parade branch onto the official T3 Code and run the repo's changed-file checks.
# Usage: scripts/parade-sync.sh [--push]
set -euo pipefail

UPSTREAM_URL=https://github.com/pingdotgg/t3code.git
BRANCH=parade
BROWSER_LIBS="$HOME/.local/share/browser-libs/root/usr/lib/x86_64-linux-gnu"

cd "$(git rev-parse --show-toplevel)"
[ "$(git branch --show-current)" = "$BRANCH" ] || { echo "Checkout $BRANCH first." >&2; exit 2; }
[ -z "$(git status --porcelain)" ] || { echo "Working tree is not clean; commit or stash first." >&2; exit 2; }

git remote get-url upstream >/dev/null 2>&1 || git remote add upstream "$UPSTREAM_URL"
git fetch --quiet upstream
behind=$(git rev-list --count HEAD..upstream/main)
if [ "$behind" -eq 0 ]; then
	echo "Already on top of upstream/main."
	exit 0
fi

backup="parade-backup/$(date +%Y-%m-%d-%H%M)"
git branch "$backup" HEAD
echo "Backup: $backup. Rebasing $(git rev-list --count upstream/main..HEAD) commit(s) over $behind upstream commit(s)."

if ! git rebase upstream/main; then
	echo
	echo "Conflicts in:"
	git diff --name-only --diff-filter=U | sed 's/^/  /'
	echo "Resolve, git add, git rebase --continue, then rerun this script. To give up: git rebase --abort"
	exit 1
fi

vp install
vp run i18n:check
if [ -d "$BROWSER_LIBS" ]; then
	export LD_LIBRARY_PATH="$BROWSER_LIBS${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi
vp run check:changed upstream/main

if [ "${1:-}" = "--push" ]; then
	git push --force-with-lease origin "$BRANCH"
else
	echo "Checks passed. Publish with: git push --force-with-lease origin $BRANCH"
fi
