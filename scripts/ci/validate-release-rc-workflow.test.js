import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

const asNeedsList = (needs) => Array.isArray(needs) ? needs : [needs];

test("stable release validates tags and committed versions before any build or publish", () => {
  const workflow = parse(readFileSync(".github/workflows/release.yml", "utf8"));
  const validate = workflow.jobs.validate;
  const steps = validate.steps;
  const stepNames = steps.map((step) => step.name);

  expect(stepNames).toContain("Validate stable tag naming");
  expect(stepNames).toContain("Resolve and validate release notes");
  expect(stepNames).toContain("Verify app versions match the stable tag");
  expect(stepNames).toContain("Verify committed FOSS release version matches the stable tag");
  expect(stepNames).toContain("Verify CloudKit production schema is fully deployed");
  expect(stepNames).toContain("Verify stable tag points at this commit");
  expect(validate.outputs.release_notes_path).toBe(
    "${{ steps.release_notes.outputs.body_path }}"
  );

  const versionStep = steps.find((step) => step.name === "Verify app versions match the stable tag");
  expect(versionStep.run).toContain("apps/desktop/src-tauri/tauri.conf.json");
  expect(versionStep.run).toContain("apps/desktop/src-tauri/Cargo.toml");
  const releaseNotesStep = steps.find(
    (step) => step.name === "Resolve and validate release notes"
  );
  expect(releaseNotesStep.run).toContain('docs/release-notes/${TAG}.md');
  expect(releaseNotesStep.run).toContain('docs/release-notes/${VERSION}.md');
  expect(releaseNotesStep.run).toContain("Stable release notes heading must include");
  const fossStep = steps.find(
    (step) => step.name === "Verify committed FOSS release version matches the stable tag"
  );
  expect(fossStep.run).toContain("apps/mobile/release-version.json");

  const releaseSteps = workflow.jobs.release.steps;
  expect(releaseSteps.some((step) => step.name === "Resolve release notes")).toBe(false);
  const createReleaseStep = releaseSteps.find((step) => step.name === "Create Release");
  expect(createReleaseStep.env.NOTES_FILE).toBe(
    "${{ needs.validate.outputs.release_notes_path }}"
  );
  expect(createReleaseStep.run).toContain('--notes-file "$NOTES_FILE"');

  const buildJobs = [
    "linux",
    "macos",
    "windows",
    "android-version-code",
    "android",
    "android-foss",
    "ios-appstore",
    "macos-appstore",
    "release",
  ];
  for (const jobName of buildJobs) {
    expect(asNeedsList(workflow.jobs[jobName].needs)).toContain("validate");
  }

  const publishJobs = [
    "update-packages",
    "update-flathub",
    "update-flathub-beta",
    "update-linux-repos",
    "update-aur-bin-beta",
    "update-linux-repos-beta",
    "publish-chocolatey",
    "update-aur",
    "update-aur-source",
  ];
  for (const jobName of publishJobs) {
    const job = workflow.jobs[jobName];
    expect(asNeedsList(job.needs)).toContain("validate");
    expect(job.if).toContain("needs.validate.result == 'success'");
  }
});

test("RC tag pushes publish Android builds to Play internal and open testing", () => {
  const workflow = parse(readFileSync(".github/workflows/release-rc.yml", "utf8"));
  const playTrack = workflow.jobs.android.with.play_track;

  expect(playTrack).toContain("'internal,beta'");
});

test("RC workflow dispatch defaults include Play open testing", () => {
  const workflow = parse(readFileSync(".github/workflows/release-rc.yml", "utf8"));

  expect(workflow.on.workflow_dispatch.inputs.play_track.default).toBe("beta");
});

test("RC Android Play and FOSS builds share a parallel versionCode preflight", () => {
  const workflow = parse(readFileSync(".github/workflows/release-rc.yml", "utf8"));

  expect(workflow.jobs["android-version-code"]).toBeDefined();
  expect(workflow.jobs.android.needs).toEqual(["validate", "android-version-code"]);
  expect(workflow.jobs.android.with.version_code).toBe("${{ needs['android-version-code'].outputs.version_code }}");
  expect(workflow.jobs["android-foss"].needs).toEqual(["validate", "android-version-code"]);
  expect(workflow.jobs["android-foss"].with.version_code).toBe("${{ needs['android-version-code'].outputs.version_code }}");
});

test("RC validation checks the committed FOSS version before platform builds start", () => {
  const workflow = parse(readFileSync(".github/workflows/release-rc.yml", "utf8"));
  const steps = workflow.jobs.validate.steps;
  const versionCheckIndex = steps.findIndex(
    (step) => step.name === "Verify committed FOSS release version matches the RC tag"
  );
  const tagCommitCheckIndex = steps.findIndex(
    (step) => step.name === "Verify RC tag points at this commit"
  );

  expect(versionCheckIndex).toBeGreaterThan(-1);
  expect(steps[versionCheckIndex].run).toContain("apps/mobile/release-version.json");
  expect(steps[versionCheckIndex].run).toContain("./scripts/bump-version.sh");
  expect(versionCheckIndex).toBeLessThan(tagCommitCheckIndex);
});
