import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("native CI generates clean projects and compiles Android and iOS sources", () => {
  const workflow = readFileSync(".github/workflows/native-platform-ci.yml", "utf8");

  expect(workflow).toContain('apps/mobile/modules/**/android/**');
  expect(workflow).toContain('apps/mobile/modules/**/ios/**');
  expect(workflow.match(/- "scripts\/ci\/setup-ruby\.sh"/g)).toHaveLength(2);
  expect(workflow).toContain("ios: ${{ steps.filter.outputs.ios }}");
  expect(workflow).toMatch(/apps\/mobile\/ios\/\*\|[^\n]*scripts\/ci\/setup-ruby\.sh\|/);

  expect(workflow).toContain("Generate Android native project");
  expect(workflow).toMatch(/prebuild \\\n\s+--clean \\\n\s+--platform android/);
  expect(workflow).toContain(":app:compileDebugKotlin");

  expect(workflow).toContain("name: iOS Swift compile");
  expect(workflow).toContain("gem install cocoapods --version 1.16.2 --no-document");
  expect(workflow).toMatch(/prebuild \\\n\s+--clean \\\n\s+--platform ios/);
  expect(workflow).toContain("-sdk iphonesimulator");
  expect(workflow).toContain("CODE_SIGNING_ALLOWED=NO");
});
