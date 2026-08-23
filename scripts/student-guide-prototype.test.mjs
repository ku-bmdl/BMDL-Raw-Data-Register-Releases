import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const downloadPage = readFileSync(new URL("site/raw-data-register/index.html", root), "utf8");
const guide = readFileSync(new URL("site/raw-data-register/guide-prototype/index.html", root), "utf8");
const runtime = readFileSync(new URL("site/raw-data-register/guide-prototype/guide.js", root), "utf8");
const styles = readFileSync(new URL("site/raw-data-register/guide-prototype/guide.css", root), "utf8");
const contract = JSON.parse(readFileSync(new URL("site/raw-data-register/guide-prototype/flow-v1.json", root), "utf8"));
const packageJson = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));

test("download page links only to the explicitly marked prototype route", () => {
  assert.match(downloadPage, /guide-prototype\/\?variant=wizard/);
  assert.match(downloadPage, /Student workflow prototype/);
  assert.match(guide, /PROTOTYPE — do not publish as the final student guide/);
  assert.match(guide, /noindex, nofollow, noarchive/);
});

test("prototype contract defines the three-step registered RAW workflow", () => {
  assert.equal(contract.contract_version, "registered-raw-student-flow-v1");
  assert.equal(contract.status, "prototype");
  assert.deepEqual(contract.steps.map(step => step.id), [
    "register", "add_data", "review_submit",
  ]);
  assert.equal(contract.source_paths.length, 2);
  assert.match(contract.source_paths[0].instruction, /custom board/);
  assert.match(contract.source_paths[0].instruction, /own computer/);
  assert.equal(contract.capture_boundary.all_required.length, 3);
  assert.equal(contract.add_data_loop.single_transfer_at_a_time, true);
  assert.equal(contract.add_data_loop.explain_before_next_package, true);
  assert.equal(contract.faq.length, 10);
});

test("three variants are structurally different and share one contract", () => {
  for (const variant of ["cards", "wizard", "map"]) {
    assert.match(guide, new RegExp(`data-variant="${variant}"`));
    assert.match(runtime, new RegExp(`id: "${variant}"`));
  }
  assert.match(runtime, /renderCards\(\)/);
  assert.match(runtime, /renderWizard\(\)/);
  assert.match(runtime, /renderMap\(\)/);
  assert.match(runtime, /fetch\("flow-v1\.json"/);
  assert.match(styles, /\.cards-overview/);
  assert.match(styles, /\.wizard-screen/);
  assert.match(styles, /\.journey-map/);
});

test("floating switcher is URL-stable, keyboard-aware and local-only", () => {
  assert.match(guide, /id="prototype-switcher"/);
  assert.match(runtime, /url\.searchParams\.set\("variant", currentVariant\)/);
  assert.match(runtime, /event\.key === "ArrowLeft"/);
  assert.match(runtime, /event\.key === "ArrowRight"/);
  assert.match(runtime, /target\.matches\("input, textarea"\)/);
  assert.match(runtime, /"localhost", "127\.0\.0\.1"/);
  assert.match(runtime, /prototype-switcher"\)\.hidden = !prototypeHost/);
});

test("guide teaches both source paths and the Capture boundary", () => {
  assert.match(runtime, /LAB INSTRUMENT OR OWN SETUP/);
  assert.match(runtime, /custom board or software is recording them on this computer/);
  assert.match(runtime, /SHARED OR CORE FACILITY/);
  assert.match(runtime, /Do these selected files form one Capture\?/);
  assert.match(runtime, /File extensions do not decide the boundary/);
  assert.match(runtime, /Different source, session or scientific meaning means a separate Capture/);
});

test("guide preserves the one-package explain-and-repeat loop", () => {
  assert.deepEqual(contract.add_data_loop.operations, [
    "PREPARE PACKAGE",
    "UPLOAD & VERIFY",
    "EXPLAIN THIS PACKAGE",
    "ADD ANOTHER REGISTERED PACKAGE",
  ]);
  assert.match(runtime, /ADD ANOTHER REGISTERED PACKAGE/);
  assert.match(runtime, /one package before adding the next/i);
  assert.match(runtime, /Additional Data submission/);
  assert.match(runtime, /Raman measurement/);
  assert.match(runtime, /Fixture photographs/);
});

test("prototype is private, read-only and usable without JavaScript", () => {
  assert.match(guide, /<noscript>/);
  assert.match(guide, /This page guides you; it never reads or uploads your files/);
  assert.doesNotMatch(guide, /type="file"/i);
  assert.doesNotMatch(runtime, /localStorage|sessionStorage/);
  assert.doesNotMatch(runtime, /google\.script|fetch\([^)]*https:/);
  assert.match(guide, /aria-live="polite"/);
  assert.match(styles, /@media \(max-width: 680px\)/);
  assert.match(styles, /\.journey-map \.map-node\.receipt \{ grid-column: 2; grid-row: 8; \}/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("prototype has one-command local preview", () => {
  assert.equal(
    packageJson.scripts["preview:guide"],
    "python3 -m http.server 4174 --directory site",
  );
});

test("direct file preview boots from an embedded copy of the contract", () => {
  const embeddedMatch = guide.match(
    /<script id="flow-contract" type="application\/json">([\s\S]*?)<\/script>/,
  );

  assert.ok(embeddedMatch, "the guide must carry a file://-safe contract fallback");
  assert.deepEqual(JSON.parse(embeddedMatch[1]), contract);
  assert.match(guide, /<script defer src="guide\.js"><\/script>/);
  assert.doesNotMatch(guide, /<script type="module" src="guide\.js"><\/script>/);
  assert.match(runtime, /window\.location\.protocol === "file:"/);
});
