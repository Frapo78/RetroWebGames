#!/usr/bin/env bash
# Run the RetroWebGames validators in this VPS checkout.
#
# Why this wrapper exists: upstream keeps the site root and `scripts/` in the
# same directory, and every validator derives its root from that assumption
# (`process.cwd()`, or the script directory's parent). This checkout publishes
# from `public/`, so neither location satisfies both. Rather than patch twenty
# validators — and drift from upstream — we assemble the shape they expect in a
# throwaway tree and run them there.
#
# The tree is built under the project's own `.work/` (git-ignored, same
# filesystem, known ownership). It is deliberately NOT under /tmp: with
# `fs.protected_regular=2` a sticky world-writable directory makes the same
# path behave differently for `fra` and for a later sudo run. See
# /var/server-docs/AI_Memory/incidents/2026-09-02-rwg-update-tmp-lock-protected-regular.md
#
# Usage:
#   bash scripts/validate-local.sh              # full contract suite
#   bash scripts/validate-local.sh validate-session.mjs   # one validator
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TREE="${ROOT}/.work/validate-tree"

rm -rf "${TREE}"
mkdir -p "${TREE}"

# Hardlinks keep this cheap and read-only in practice: validators never write.
cp -al "${ROOT}/public/." "${TREE}/"
for dir in scripts docs server ops; do
  cp -al "${ROOT}/${dir}" "${TREE}/"
done
cp -a "${ROOT}/AGENTS.md" "${ROOT}/README.md" "${ROOT}/TODO.md" "${TREE}/"

target="${1:-validate-contracts.mjs}"
cd "${TREE}"
node "scripts/${target}"
status=$?
cd "${ROOT}"
exit "${status}"
