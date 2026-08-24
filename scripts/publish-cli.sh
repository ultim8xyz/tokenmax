#!/usr/bin/env bash
# Push packages/cli to the standalone repo people install from.
#
# npm cannot install from a subdirectory of a git repo, so the CLI needs its own
# origin. This keeps one source of truth: the monorepo, pushed out as a subtree.
set -euo pipefail

REMOTE="${1:-git@github.com:ultim8xyz/tokenmax-cli.git}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT"
( cd packages/cli && bun run build )

if ! git diff --quiet -- packages/cli; then
  echo "packages/cli has uncommitted changes; commit the build first." >&2
  exit 1
fi

git subtree push --prefix packages/cli "$REMOTE" main
echo "pushed packages/cli -> $REMOTE"
