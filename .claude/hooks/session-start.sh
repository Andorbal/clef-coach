#!/bin/bash
# Cloud sessions start from a fresh clone: install the npm dependencies so unit tests,
# typecheck, build and Playwright (with the preinstalled Chromium) work straight away.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# npm install (not ci): reuses what the cached container already has.
# Playwright uses the browsers in /opt/pw-browsers; never download its own.
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund
