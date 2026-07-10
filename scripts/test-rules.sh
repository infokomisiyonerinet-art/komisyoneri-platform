#!/usr/bin/env bash
# Runs the Firestore Security Rules test suite against the Firebase
# Emulator Suite and generates a Markdown pass/fail report. Safe to run
# anytime — everything happens against the emulator, zero risk to
# production Firestore data.
#
# Usage: ./scripts/test-rules.sh
# Report: tests/rules/out/RULES_TEST_REPORT.md
#
# Run from repo root so firebase.json (which defines the emulator ports)
# resolves naturally. See tests/rules/README.md for details.
set -e
cd "$(dirname "$0")/.."
npx --yes firebase-tools emulators:exec --project demo-komisyoneri --only firestore,auth \
  "npm --prefix tests/rules run test:rbac"
