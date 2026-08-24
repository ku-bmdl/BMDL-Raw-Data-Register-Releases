import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/publish-catalog.yml", "utf8");

test("manual Pages recovery remains pilot-only and secretless", () => {
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /contents: read/u);
  assert.match(
    workflow,
    /approve-stable:\s+if: \$\{\{ github\.event_name == 'release' && !github\.event\.release\.prerelease \}\}/u,
  );
  assert.match(
    workflow,
    /publish-stable:\s+if: \$\{\{ github\.event_name == 'release' && needs\.approve-stable\.result == 'success' \}\}/u,
  );
});
