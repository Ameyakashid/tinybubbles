import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("MCP publisher is versioned and checksum-verified before credentials are used", () => {
  const workflow = read(".github/workflows/publish-mcp.yml");

  expect(workflow).toContain('MCP_PUBLISHER_VERSION: "1.8.0"');
  expect(workflow).toMatch(/MCP_PUBLISHER_LINUX_AMD64_SHA256: "[a-f0-9]{64}"/);
  expect(workflow).toContain(
    "releases/download/v${MCP_PUBLISHER_VERSION}/${archive}",
  );
  expect(workflow).toContain("sha256sum --check --strict");
  expect(workflow).not.toContain("releases/latest/download");
  const npmInstall = workflow.match(/npm install -g npm@([^\s]+)/);
  expect(npmInstall?.[1]).toBe("11.5.1");
  expect(npmInstall?.[1]).not.toMatch(/[~^*xX]/);

  const installIndex = workflow.indexOf("- name: Install mcp-publisher");
  const loginIndex = workflow.indexOf("./mcp-publisher login github-oidc");
  expect(installIndex).toBeGreaterThanOrEqual(0);
  expect(loginIndex).toBeGreaterThan(installIndex);
});

test("Android releases use the isolated, repository-locked EAS CLI", () => {
  const manifest = JSON.parse(read("tools/eas-cli/package.json"));
  const lock = JSON.parse(read("tools/eas-cli/package-lock.json"));
  const workflow = read(".github/workflows/release-android.yml");

  expect(manifest.dependencies["eas-cli"]).toBe("21.5.0");
  expect(lock.packages["node_modules/eas-cli"].version).toBe("21.5.0");
  expect(workflow).toContain("npm ci --prefix tools/eas-cli --ignore-scripts");
  expect(workflow).toContain(
    "$GITHUB_WORKSPACE/tools/eas-cli/node_modules/.bin/eas",
  );
  expect(workflow).not.toContain("npm install -g eas-cli");
});

test("Apple release workflows execute the locked Fastlane bundle", () => {
  const gemfile = read("Gemfile");
  const lockfile = read("Gemfile.lock");

  expect(gemfile).toContain('gem "fastlane", "2.237.0"');
  expect(lockfile).toContain("fastlane (= 2.237.0)");
  expect(lockfile).toContain("BUNDLED WITH\n  4.0.3");

  for (const path of [
    ".github/workflows/release-ios-appstore.yml",
    ".github/workflows/release-macos-appstore.yml",
  ]) {
    const workflow = read(path);
    expect(workflow).toContain("bundle install --jobs 4 --retry 3");
    expect(workflow).toContain("bundle exec fastlane");
    expect(workflow).not.toContain("gem install fastlane --no-document");
  }
});
