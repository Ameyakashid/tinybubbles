#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const mobilePackagePath = path.join(repoRoot, 'apps/mobile/package.json');
const mobileLockPath = path.join(repoRoot, 'apps/mobile/package-lock.json');
const corePackagePath = path.join(repoRoot, 'packages/core/package.json');

const pkg = JSON.parse(fs.readFileSync(mobilePackagePath, 'utf8'));

if (pkg.dependencies && pkg.dependencies['expo-dev-client']) {
  delete pkg.dependencies['expo-dev-client'];
}
if (pkg.devDependencies && pkg.devDependencies['expo-dev-client']) {
  delete pkg.devDependencies['expo-dev-client'];
}

if (!pkg.expo || typeof pkg.expo !== 'object' || Array.isArray(pkg.expo)) {
  pkg.expo = {};
}
if (!pkg.expo.autolinking || typeof pkg.expo.autolinking !== 'object' || Array.isArray(pkg.expo.autolinking)) {
  pkg.expo.autolinking = {};
}
const existingExclude = Array.isArray(pkg.expo.autolinking.exclude)
  ? pkg.expo.autolinking.exclude.filter((value) => typeof value === 'string')
  : [];
for (const excludedModule of ['play-store-updates', 'expo-store-review']) {
  if (!existingExclude.includes(excludedModule)) {
    existingExclude.push(excludedModule);
  }
}
pkg.expo.autolinking.exclude = existingExclude;
if (pkg.dependencies && pkg.dependencies['@tinybubbles/core'] === 'workspace:*') {
  pkg.dependencies['@tinybubbles/core'] = 'file:../../packages/core';
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tinybubbles-mobile-foss-package-'));
const tmpMobileDir = path.join(tmpDir, 'apps/mobile');
const tmpCoreDir = path.join(tmpDir, 'packages/core');
const tmpPackagePath = path.join(tmpMobileDir, 'package.json');
const tmpLockPath = path.join(tmpMobileDir, 'package-lock.json');

fs.mkdirSync(tmpMobileDir, { recursive: true });
fs.mkdirSync(tmpCoreDir, { recursive: true });
fs.writeFileSync(tmpPackagePath, `${JSON.stringify(pkg, null, 2)}\n`);
fs.copyFileSync(mobileLockPath, tmpLockPath);
fs.copyFileSync(corePackagePath, path.join(tmpCoreDir, 'package.json'));

let status = 1;
try {
  const manifestCheck = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, 'scripts/ci/check-package-lock-sync.js'),
      tmpPackagePath,
      tmpLockPath,
    ],
    { stdio: 'inherit' }
  );

  if ((manifestCheck.status ?? 1) === 0) {
    const npmCheck = spawnSync(
      'npm',
      [
        'ci',
        '--package-lock-only',
        '--workspaces=false',
        '--legacy-peer-deps',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--prefix',
        tmpMobileDir,
      ],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          npm_config_cache: path.join(tmpDir, '.npm-cache'),
        },
      }
    );
    status = npmCheck.status ?? 1;
  }
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

process.exit(status);
