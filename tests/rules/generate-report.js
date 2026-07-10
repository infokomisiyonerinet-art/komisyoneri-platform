#!/usr/bin/env node
// Parses mocha's --reporter json output (tests/rules/out/results.json) and
// writes a human-readable Markdown pass/fail report. For every failure, it
// best-effort matches the failing test's title against the real
// rules/firestore.rules collection blocks and reports the actual line
// number to check — not just "test failed". Exits non-zero if any test
// failed, so this can be wired into a CI check later.

const fs = require('fs');
const path = require('path');

const RESULTS_PATH = path.join(__dirname, 'out', 'results.json');
const REPORT_PATH = path.join(__dirname, 'out', 'RULES_TEST_REPORT.md');
const RULES_PATH = path.join(__dirname, '..', '..', 'rules', 'firestore.rules');

function fileLabel(filePath) {
  return path.basename(filePath || 'unknown', '.spec.js');
}

// Maps each `match /collection/{id} {` block in the real rules file to its
// line number, so a failing test's title (which always names the
// collection, e.g. "deals — P0.1: ...") can point straight at the rule.
function buildCollectionLineMap() {
  var map = {};
  if (!fs.existsSync(RULES_PATH)) return map;
  var lines = fs.readFileSync(RULES_PATH, 'utf8').split('\n');
  lines.forEach(function (line, idx) {
    var m = line.match(/match\s+\/(\w+)\/\{/);
    if (m) map[m[1]] = idx + 1; // 1-indexed
  });
  return map;
}

function findRuleHint(fullTitle, collectionLineMap) {
  var lower = fullTitle.toLowerCase();
  var hits = Object.keys(collectionLineMap).filter(function (coll) {
    return lower.indexOf(coll.toLowerCase()) > -1;
  });
  if (!hits.length) return null;
  return hits.map(function (coll) {
    return 'rules/firestore.rules:' + collectionLineMap[coll] + ' (match /' + coll + '/{id})';
  }).join(', ');
}

function main() {
  if (!fs.existsSync(RESULTS_PATH)) {
    console.error('No results.json found at ' + RESULTS_PATH + ' — run `npm test` first.');
    process.exit(1);
  }

  var raw = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8'));
  var stats = raw.stats || {};
  var tests = raw.tests || [];
  var failures = raw.failures || [];
  var collectionLineMap = buildCollectionLineMap();

  var failureTitles = {};
  failures.forEach(function (f) { failureTitles[f.fullTitle] = true; });

  var byFile = {};
  tests.forEach(function (t) {
    var label = fileLabel(t.file);
    if (!byFile[label]) byFile[label] = { total: 0, passed: 0, failed: 0 };
    byFile[label].total++;
    if (failureTitles[t.fullTitle]) byFile[label].failed++;
    else byFile[label].passed++;
  });

  var timestamp = new Date().toISOString();
  var lines = [];
  lines.push('# K-REOS Firestore Rules Test Report');
  lines.push('');
  lines.push('**Run:** ' + timestamp);
  lines.push('');
  lines.push('Run against the Firebase Emulator Suite, using the real `rules/firestore.rules` ' +
    'file (not a copy) — a passing report reflects what is actually deployed.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Suite | Total | Passed | Failed |');
  lines.push('|---|---|---|---|');
  Object.keys(byFile).sort().forEach(function (label) {
    var s = byFile[label];
    lines.push('| ' + label + ' | ' + s.total + ' | ' + s.passed + ' | ' + s.failed + ' |');
  });
  lines.push('| **TOTAL** | **' + (stats.tests || 0) + '** | **' + (stats.passes || 0) + '** | **' + (stats.failures || 0) + '** |');
  lines.push('');
  var passRate = stats.tests ? ((stats.passes / stats.tests) * 100).toFixed(1) : '0.0';
  lines.push('**Pass rate: ' + passRate + '%**');
  lines.push('');
  lines.push('## Failures');
  lines.push('');

  if (failures.length) {
    failures.forEach(function (f) {
      var hint = findRuleHint(f.fullTitle, collectionLineMap);
      lines.push('### ' + f.fullTitle);
      lines.push('');
      lines.push('- **Spec file**: `' + fileLabel(f.file) + '.spec.js`');
      lines.push('- **Rule to check**: ' + (hint || '(could not auto-match a collection name — check the spec file for context)'));
      lines.push('- **What happened**: the rule allowed/denied the request differently than the test expected (see error below).');
      lines.push('');
      lines.push('```');
      lines.push((f.err && (f.err.message || f.err.stack)) || '(no error message captured)');
      lines.push('```');
      lines.push('');
    });
  } else {
    lines.push('None — all rules behaved as expected. ✅');
    lines.push('');
  }

  fs.writeFileSync(REPORT_PATH, lines.join('\n'));
  console.log('Report written to ' + REPORT_PATH);
  console.log((stats.passes || 0) + '/' + (stats.tests || 0) + ' passed (' + passRate + '%)');

  process.exit((stats.failures || 0) > 0 ? 1 : 0);
}

main();
