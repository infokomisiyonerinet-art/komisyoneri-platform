// Shared emulator-environment factory for every spec file. Loads the REAL
// rules/firestore.rules used in production — not a copy — so a passing
// suite actually reflects what's deployed.

const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

function makeTestEnv() {
  return initializeTestEnvironment({
    projectId: 'demo-komisyoneri',
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, '../../rules/firestore.rules'), 'utf8'),
      host: 'localhost',
      port: 8080
    }
  });
}

module.exports = { makeTestEnv };
