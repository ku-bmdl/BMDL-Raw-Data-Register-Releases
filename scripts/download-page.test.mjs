import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("site/raw-data-register/index.html", "utf8");
const runtime = readFileSync("site/raw-data-register/download.js", "utf8");

test("student page keeps both platforms, three steps, checksum context, and support visible", () => {
  assert.match(page, /Universal Mac installer/);
  assert.match(page, /Windows x64 installer/);
  assert.equal((page.match(/<li>/g) || []).length, 3);
  assert.match(page, /separate from the SHA-256 fingerprints/);
  assert.match(page, /<details>/);
  assert.match(page, /mailto:lbeker@ku\.edu\.tr/);
});

test("student page reads only stable release.json and recommends without hiding platforms", () => {
  assert.match(runtime, /fetch\("release\.json"/);
  assert.doesNotMatch(runtime, /pilot\.json/);
  assert.match(runtime, /classList\.add\("recommended"\)/);
  assert.doesNotMatch(runtime, /\.remove\(\)/);
});
