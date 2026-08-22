import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("site/raw-data-register/index.html", "utf8");
const runtime = readFileSync("site/raw-data-register/download.js", "utf8");
const styles = readFileSync("site/raw-data-register/styles.css", "utf8");
const rootPage = readFileSync("site/index.html", "utf8");

test("site root directs visitors to the Raw Data Register page", () => {
  assert.match(rootPage, /url=raw-data-register\//);
  assert.match(rootPage, /https:\/\/updates\.bmdl\.bio\/raw-data-register\//);
});

test("student page keeps both platforms, three steps, checksum context, and support visible", () => {
  assert.match(page, /Universal Mac installer/);
  assert.match(page, /Windows x64 · Microsoft Store/);
  assert.match(page, /9NTVDFKS4T1C/);
  assert.match(page, /publisher <code>leventb<\/code>/);
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
  assert.match(runtime, /release\.downloads\.windows\.store_id/);
  assert.doesNotMatch(runtime, /windows\.sha256/);
});

test("a non-recommended platform keeps its recommendation badge hidden", () => {
  assert.match(styles, /\.recommendation\[hidden\]\s*\{[^}]*display:\s*none\s*!important;/s);
});
