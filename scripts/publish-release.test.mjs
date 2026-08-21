import assert from "node:assert/strict";
import test from "node:test";

import { compareSemver, parseSemver } from "./publish-release.mjs";

test("SemVer comparison only advances toward newer releases", () => {
  assert.equal(compareSemver("1.3.0-rc.2", "1.3.0-rc.1"), 1);
  assert.equal(compareSemver("1.3.0", "1.3.0-rc.2"), 1);
  assert.equal(compareSemver("1.3.1", "1.3.0"), 1);
  assert.equal(compareSemver("1.3.0", "1.3.0"), 0);
  assert.equal(compareSemver("1.2.9", "1.3.0"), -1);
});

test("invalid or partial versions are rejected", () => {
  for (const value of ["latest", "1.3", "01.3.0", "v1.3.0"]) {
    assert.throws(() => parseSemver(value), /Invalid SemVer/);
  }
});
