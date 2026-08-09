import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const IMAGE_SIZE_ADVISORIES = ["GHSA-5p2g-fcmc-qvqq", "GHSA-w3rx-r6r6-pgpr"];

const REQUIRED_PULL_REQUEST_PATHS = [
  ".github/workflows/dependency-audit.yml",
  "apps/*/package.json",
  "apps/desktop/src-tauri/Cargo.lock",
  "apps/desktop/src-tauri/Cargo.toml",
  "bun.lock",
  "package.json",
  "packages/*/package.json",
  "scripts/ci/validate-dependency-audit.test.js",
  "tools/eas-cli/package-lock.json",
  "tools/eas-cli/package.json",
];

test("Bun audit exceptions stay limited to Metro's unpatched build dependency", () => {
  const workflow = readFileSync(".github/workflows/dependency-audit.yml", "utf8");
  const lockfile = readFileSync("bun.lock", "utf8");

  for (const advisory of IMAGE_SIZE_ADVISORIES) {
    expect(workflow.match(new RegExp(`--ignore=${advisory}`, "g"))).toHaveLength(1);
  }
  expect(workflow.match(/--ignore=/g)).toHaveLength(IMAGE_SIZE_ADVISORIES.length);

  const imageSizeReferences = lockfile.match(/"image-size": "[^"]+"/g) ?? [];
  expect(imageSizeReferences).toEqual([
    '"image-size": "bin/image-size.js"',
    '"image-size": "^1.0.2"',
  ]);
  expect(lockfile).toContain('["image-size@1.2.1"');
  expect(lockfile).toMatch(
    /\["metro@[^\n]+"[^\n]+"dependencies": \{[^\n]+"image-size": "\^1\.0\.2"/,
  );
});

test("dependency changes run the audit before merge", () => {
  const workflow = readFileSync(".github/workflows/dependency-audit.yml", "utf8");
  const pullRequestBlock = workflow.match(/\n  pull_request:\n    paths:\n((?:      - .+\n)+)/)?.[1];

  expect(pullRequestBlock).toBeDefined();
  const paths = pullRequestBlock
    .trim()
    .split("\n")
    .map((line) => line.replace(/^\s*-\s*/, "").replace(/^['\"]|['\"]$/g, ""))
    .sort();

  expect(paths).toEqual(REQUIRED_PULL_REQUEST_PATHS);
  expect(workflow).toContain('cron: "23 3 * * 1"');
  expect(workflow).toMatch(/\n  workflow_dispatch:\s*\n/);
});
