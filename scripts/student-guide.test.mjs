import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const downloadPage = readFileSync(new URL("site/raw-data-register/index.html", root), "utf8");
const guide = readFileSync(new URL("site/raw-data-register/guide/index.html", root), "utf8");
const runtime = readFileSync(new URL("site/raw-data-register/guide/guide.js", root), "utf8");
const styles = readFileSync(new URL("site/raw-data-register/guide/guide.css", root), "utf8");
const contract = JSON.parse(readFileSync(new URL("site/raw-data-register/guide/flow-v2.json", root), "utf8"));
const packageJson = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));

test("download page links to the canonical student guide", () => {
  assert.match(downloadPage, /href="guide\/"/);
  assert.match(downloadPage, /Student workflow guide/);
  assert.match(downloadPage, /OPEN STUDENT GUIDE/);
  assert.doesNotMatch(downloadPage, /guide-prototype|variant=/);
  assert.match(guide, /STUDENT GUIDE/);
  assert.match(guide, /Official BMDL student workflow guide/);
  assert.doesNotMatch(guide, /PROTOTYPE|noindex|noarchive/);
});

test("active contract defines the full three-stage registered RAW workflow", () => {
  assert.equal(contract.contract_version, "registered-raw-student-flow-v2");
  assert.equal(contract.status, "active");
  assert.deepEqual(contract.stages.map(step => step.id), [
    "register", "add_data", "review_submit",
  ]);
  assert.equal(contract.source_paths.length, 2);
  assert.match(contract.source_paths[0].instruction, /custom board/);
  assert.match(contract.source_paths[0].instruction, /own computer/);
  assert.match(contract.source_paths[1].instruction, /USB/);
  assert.match(contract.source_paths[1].instruction, /your own computer/);
  assert.equal(contract.capture_boundary.one_capture_when.length, 3);
  assert.equal(contract.entry_rules.create_surfaces.length, 2);
  assert.match(contract.entry_rules.plan_is_not_record, /Plan an experiment/);
  assert.deepEqual(contract.checkpoints.map(item => item.label), [
    "RAW — REGISTERED",
    "LOCAL EXPORT VERIFIED",
    "TRANSFER INTEGRITY CONFIRMED",
    "EXPLANATION COMPLETE",
    "FINAL RECEIPT",
  ]);
  assert.match(contract.capture_boundary.same_experiment_multiple_data, /Raman/);
  assert.equal(contract.submission_rules.at_least_one_data_set_required, true);
  assert.equal(contract.submission_rules.context_only_submission_available, false);
  assert.equal(contract.faq.length, 12);
});

test("chosen C1 flow is the only guide design", () => {
  assert.match(guide, /id="journey-root"/);
  assert.match(runtime, /renderJourney\(\)/);
  assert.match(runtime, /fetch\("flow-v2\.json"/);
  assert.match(styles, /\.guided-flow/);
  assert.match(styles, /\.guided-path/);
  assert.doesNotMatch(guide, /data-variant|variant-hub|prototype-switcher|C2/);
  assert.doesNotMatch(runtime, /VARIANTS|currentVariant|renderHub|wireSwitcher|variant=/);
  assert.doesNotMatch(styles, /\.growing-map|\.map-stage-grid|\.prototype-switcher/);
});

test("answers reveal only the next applicable flow node", () => {
  assert.match(runtime, /let flowState = createFlowState\(\)/);
  assert.match(runtime, /function currentStep\(\)/);
  assert.match(runtime, /data-flow-choice/);
  assert.match(runtime, /handleChoice\(button\.dataset\.flowChoice\)/);
  assert.match(runtime, /Future steps stay hidden until your answer makes them relevant/);
  assert.match(runtime, /data-flow-reset/);
  assert.match(runtime, /scrollIntoView\(\{behavior: "smooth", block: "center"\}\)/);
  assert.match(styles, /\.flow-arrow-down/);
  assert.doesNotMatch(runtime, /localStorage|sessionStorage/);
});

test("guide teaches source transfer, browser Experiment entry and the Capture boundary", () => {
  assert.match(runtime, /SHARED FACILITY/);
  assert.match(runtime, /Facility originals unchanged → copy to USB → bring to your computer → register promptly/);
  assert.match(runtime, /How will you connect this package to an Experiment\?/);
  assert.match(runtime, /SELECT EXISTING EXPERIMENT/);
  assert.match(runtime, /CREATE NEW EXPERIMENT/);
  assert.match(runtime, /Record new experiment/);
  assert.match(runtime, /Slack offers the same form but is optional/);
  assert.match(runtime, /Capture check " \+ \(captureIndex \+ 1\) \+ " of 3/);
  assert.match(runtime, /All three answers must be YES/);
  assert.match(runtime, /Split the selection before registration/);
});

test("guide preserves proof checkpoints and the same-Experiment data loop", () => {
  assert.equal(contract.checkpoints[2].not_final_receipt, true);
  assert.match(runtime, /Is there another registered data set for this Experiment\?/);
  assert.match(runtime, /YES — ADD ANOTHER/);
  assert.match(runtime, /Return to Stage 1 for the next data set/);
  assert.match(runtime, /Additional Data/);
  assert.match(runtime, /contract\.checkpoints/);
  assert.match(styles, /\.flow-proof/);
});

test("guide is public, read-only, responsive and usable without JavaScript", () => {
  assert.match(guide, /<noscript>/);
  assert.match(guide, /This guide never reads or uploads your files/);
  assert.doesNotMatch(guide, /type="file"/i);
  assert.doesNotMatch(runtime, /google\.script|fetch\([^)]*https:/);
  assert.match(guide, /aria-live="polite"/);
  assert.match(styles, /@media \(max-width: 680px\)/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.doesNotMatch(styles, /\.cards-overview|\.wizard-screen|\.map-connector/);
});

test("guide has one-command local preview", () => {
  assert.equal(
    packageJson.scripts["preview:guide"],
    "python3 -m http.server 4174 --directory site",
  );
});

test("direct file opening upgrades the embedded fallback to the active contract", () => {
  const embeddedMatch = guide.match(
    /<script id="flow-contract" type="application\/json">([\s\S]*?)<\/script>/,
  );

  assert.ok(embeddedMatch, "the guide must carry a file://-safe contract fallback");
  assert.equal(JSON.parse(embeddedMatch[1]).contract_version,
    "registered-raw-student-flow-v1");
  assert.match(runtime, /contract_version: "registered-raw-student-flow-v2"/);
  assert.match(runtime, /one_capture_when: legacy\.capture_boundary\.all_required/);
  assert.match(guide, /<script defer src="guide\.js"><\/script>/);
  assert.doesNotMatch(guide, /<script type="module" src="guide\.js"><\/script>/);
  assert.match(runtime, /window\.location\.protocol === "file:"/);
});
