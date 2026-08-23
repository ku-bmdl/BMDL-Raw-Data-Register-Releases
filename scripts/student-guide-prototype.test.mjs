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
  assert.match(downloadPage, /guide-prototype\/\?variant=journey/);
  assert.match(downloadPage, /two interactive map designs/);
  assert.match(downloadPage, /Student workflow prototype/);
  assert.match(guide, /PROTOTYPE — do not publish as the final student guide/);
  assert.match(guide, /noindex, nofollow, noarchive/);
});

test("prototype contract defines the full three-stage registered RAW workflow", () => {
  assert.equal(contract.contract_version, "registered-raw-student-flow-v1");
  assert.equal(contract.status, "prototype");
  assert.deepEqual(contract.steps.map(step => step.id), [
    "register", "add_data", "review_submit",
  ]);
  assert.equal(contract.source_paths.length, 2);
  assert.match(contract.source_paths[0].instruction, /custom board/);
  assert.match(contract.source_paths[0].instruction, /own computer/);
  assert.deepEqual(contract.facility_transfer.operations, [
    "Keep the facility-delivered original files unchanged.",
    "Copy the unchanged delivery to a USB drive.",
    "Bring the USB drive to your own computer.",
    "Register the delivered originals on that computer promptly.",
  ]);
  assert.equal(contract.capture_boundary.all_required.length, 3);
  assert.equal(contract.experiment_id_decision.unknown.before_web_upload.length, 4);
  assert.match(contract.experiment_id_decision.not_equivalent, /Plan an experiment/);
  assert.deepEqual(contract.verification_checkpoints.map(item => item.label), [
    "RAW — REGISTERED",
    "LOCAL EXPORT VERIFIED",
    "TRANSFER INTEGRITY CONFIRMED",
    "EXPLANATION COMPLETE",
    "SLACK RECEIPT",
  ]);
  assert.deepEqual(contract.same_experiment_multiple_data.examples, [
    "Raman measurement", "Fixture photographs", "SEM data",
  ]);
  assert.equal(contract.faq.length, 12);
});

test("two map variants are structurally different and share one contract", () => {
  for (const variant of ["journey", "hub"]) {
    assert.match(guide, new RegExp(`data-variant="${variant}"`));
    assert.match(runtime, new RegExp(`id: "${variant}"`));
  }
  assert.doesNotMatch(guide, /data-variant="(?:cards|wizard|map)"/);
  assert.match(runtime, /renderJourney\(\)/);
  assert.match(runtime, /renderHub\(\)/);
  assert.match(runtime, /fetch\("flow-v1\.json"/);
  assert.match(styles, /\.journey-board/);
  assert.match(styles, /\.experiment-hub/);
  assert.match(styles, /\.hub-board/);
  assert.match(styles, /\.dataset-grid/);
});

test("floating switcher is URL-stable, keyboard-aware and local-only", () => {
  assert.match(guide, /id="prototype-switcher"/);
  assert.match(runtime, /url\.searchParams\.set\("variant", currentVariant\)/);
  assert.match(runtime, /event\.key === "ArrowLeft"/);
  assert.match(runtime, /event\.key === "ArrowRight"/);
  assert.match(runtime, /target instanceof Element && target\.matches\("input, textarea, \[contenteditable\]"\)/);
  assert.match(runtime, /"localhost", "127\.0\.0\.1"/);
  assert.match(runtime, /prototype-switcher"\)\.hidden = !prototypeHost/);
});

test("both maps teach source transfer, Experiment ID and the Capture boundary", () => {
  assert.match(runtime, /SHARED FACILITY/);
  assert.match(runtime, /Unchanged originals → USB → your computer → register/);
  assert.match(runtime, /Do you know the LabMate Experiment ID\?/);
  assert.match(runtime, /Record new experiment/);
  assert.match(runtime, /Save & continue/);
  assert.match(runtime, /Plan an experiment/);
  assert.match(runtime, /Before Register · all three must be YES/);
  assert.match(runtime, /ONE CAPTURE · THREE YES ANSWERS/);
});

test("both maps preserve proof checkpoints and multiple data under one Experiment", () => {
  assert.deepEqual(contract.add_data_loop.operations, [
    "EXPORT / COPY PACKAGE",
    "UPLOAD & VERIFY",
    "EXPLAIN THIS PACKAGE",
    "ADD ANOTHER REGISTERED PACKAGE",
  ]);
  assert.equal(contract.add_data_loop.single_transfer_at_a_time, true);
  assert.equal(contract.add_data_loop.explain_before_next_package, true);
  assert.match(runtime, /Different data may share one Experiment/);
  assert.match(runtime, /More registered data for this Experiment\?/);
  assert.match(runtime, /ADD ANOTHER REGISTERED DATA SET/);
  assert.match(runtime, /Additional Data/);
  assert.match(runtime, /verification_checkpoints/);
  assert.match(styles, /\.checkpoint-badge/);
});

test("prototype is private, read-only, responsive and usable without JavaScript", () => {
  assert.match(guide, /<noscript>/);
  assert.match(guide, /This guide never reads or uploads your files/);
  assert.doesNotMatch(guide, /type="file"/i);
  assert.doesNotMatch(runtime, /localStorage|sessionStorage/);
  assert.doesNotMatch(runtime, /google\.script|fetch\([^)]*https:/);
  assert.match(guide, /aria-live="polite"/);
  assert.match(styles, /@media \(max-width: 680px\)/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.doesNotMatch(styles, /\.map-connector/);
  assert.doesNotMatch(styles, /\.cards-overview|\.wizard-screen/);
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
