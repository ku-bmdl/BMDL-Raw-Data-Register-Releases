import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const downloadPage = readFileSync(new URL("site/raw-data-register/index.html", root), "utf8");
const guide = readFileSync(new URL("site/raw-data-register/guide/index.html", root), "utf8");
const runtime = readFileSync(new URL("site/raw-data-register/guide/guide.js", root), "utf8");
const styles = readFileSync(new URL("site/raw-data-register/guide/guide.css", root), "utf8");
const contract = JSON.parse(readFileSync(new URL("site/raw-data-register/guide/flow-v1.json", root), "utf8"));
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
  assert.equal(contract.contract_version, "registered-raw-student-flow-v1");
  assert.equal(contract.status, "active");
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

test("chosen C1 flow is the only guide design", () => {
  assert.match(guide, /id="journey-root"/);
  assert.match(runtime, /renderJourney\(\)/);
  assert.match(runtime, /fetch\("flow-v1\.json"/);
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

test("guide teaches source transfer, Experiment ID and the Capture boundary", () => {
  assert.match(runtime, /SHARED FACILITY/);
  assert.match(runtime, /Facility originals unchanged → copy to USB → bring to your computer → register promptly/);
  assert.match(runtime, /Do you know the LabMate Experiment ID\?/);
  assert.match(runtime, /Record new experiment/);
  assert.match(runtime, /Save & continue/);
  assert.match(runtime, /Plan an experiment/);
  assert.match(runtime, /Capture check " \+ \(captureIndex \+ 1\) \+ " of 3/);
  assert.match(runtime, /All three answers must be YES/);
  assert.match(runtime, /Split the selection before registration/);
});

test("guide preserves proof checkpoints and the same-Experiment data loop", () => {
  assert.deepEqual(contract.add_data_loop.operations, [
    "EXPORT / COPY PACKAGE",
    "UPLOAD & VERIFY",
    "EXPLAIN THIS PACKAGE",
    "ADD ANOTHER REGISTERED PACKAGE",
  ]);
  assert.equal(contract.add_data_loop.single_transfer_at_a_time, true);
  assert.equal(contract.add_data_loop.explain_before_next_package, true);
  assert.match(runtime, /Is there another registered data set for this Experiment\?/);
  assert.match(runtime, /YES — ADD ANOTHER/);
  assert.match(runtime, /Return to Stage 1 for the next data set/);
  assert.match(runtime, /Additional Data/);
  assert.match(runtime, /verification_checkpoints/);
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

test("direct file opening boots from an embedded copy of the active contract", () => {
  const embeddedMatch = guide.match(
    /<script id="flow-contract" type="application\/json">([\s\S]*?)<\/script>/,
  );

  assert.ok(embeddedMatch, "the guide must carry a file://-safe contract fallback");
  assert.deepEqual(JSON.parse(embeddedMatch[1]), contract);
  assert.match(guide, /<script defer src="guide\.js"><\/script>/);
  assert.doesNotMatch(guide, /<script type="module" src="guide\.js"><\/script>/);
  assert.match(runtime, /window\.location\.protocol === "file:"/);
});
