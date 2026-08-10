import { readFileSync } from "node:fs";

const EXPECTED_IMAGE_SIZE_ADVISORIES = [
  "GHSA-5p2g-fcmc-qvqq",
  "GHSA-w3rx-r6r6-pgpr",
];

const advisoryId = (value) => {
  if (typeof value?.url !== "string") {
    throw new Error("npm audit returned a direct advisory without a URL");
  }

  const match = value.url.match(/\/advisories\/(GHSA-[a-z0-9-]+)$/i);
  if (!match) {
    throw new Error(`npm audit returned an unrecognized advisory URL: ${value.url}`);
  }
  return match[1];
};

export const validateMobileAuditReport = (report) => {
  const vulnerabilities = report?.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== "object") {
    throw new Error("npm audit report is missing its vulnerabilities map");
  }

  const directAdvisories = [];
  const dependencyEdges = new Map();

  for (const [packageName, vulnerability] of Object.entries(vulnerabilities)) {
    if (!vulnerability || typeof vulnerability !== "object") {
      throw new Error(`npm audit returned an invalid record for ${packageName}`);
    }
    if (vulnerability.name !== packageName || !Array.isArray(vulnerability.via)) {
      throw new Error(`npm audit returned an invalid dependency record for ${packageName}`);
    }

    const edges = [];
    for (const cause of vulnerability.via) {
      if (typeof cause === "string") {
        edges.push(cause);
      } else if (cause && typeof cause === "object") {
        directAdvisories.push({ packageName, id: advisoryId(cause) });
      } else {
        throw new Error(`npm audit returned an invalid cause for ${packageName}`);
      }
    }
    dependencyEdges.set(packageName, edges);
  }

  const observedIds = directAdvisories.map(({ id }) => id).sort();
  if (
    JSON.stringify(observedIds)
    !== JSON.stringify([...EXPECTED_IMAGE_SIZE_ADVISORIES].sort())
    || directAdvisories.some(({ packageName }) => packageName !== "image-size")
  ) {
    throw new Error(
      `npm audit returned unexpected direct advisories: ${directAdvisories
        .map(({ packageName, id }) => `${packageName}:${id}`)
        .join(", ") || "none"}`,
    );
  }

  for (const [packageName, edges] of dependencyEdges) {
    for (const dependency of edges) {
      if (!dependencyEdges.has(dependency)) {
        throw new Error(
          `npm audit linked ${packageName} to missing vulnerability ${dependency}`,
        );
      }
    }
  }

  const reachesImageSize = (packageName, visiting = new Set()) => {
    if (packageName === "image-size") return true;
    if (visiting.has(packageName)) return false;

    const nextVisiting = new Set(visiting);
    nextVisiting.add(packageName);
    return (dependencyEdges.get(packageName) ?? []).some((dependency) =>
      reachesImageSize(dependency, nextVisiting)
    );
  };

  for (const packageName of dependencyEdges.keys()) {
    if (!reachesImageSize(packageName)) {
      throw new Error(
        `npm audit vulnerability ${packageName} is not transitively caused by image-size`,
      );
    }
  }
};

if (import.meta.main) {
  try {
    const reportPath = process.argv[2];
    if (!reportPath) throw new Error("usage: validate-mobile-npm-audit.js <report.json>");
    validateMobileAuditReport(JSON.parse(readFileSync(reportPath, "utf8")));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
