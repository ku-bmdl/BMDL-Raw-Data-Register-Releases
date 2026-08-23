const VARIANTS = [
  {id: "journey", key: "C1", name: "Guided journey"},
  {id: "hub", key: "C2", name: "Experiment hub"},
];

const params = new URLSearchParams(window.location.search);
let currentVariant = VARIANTS.some(item => item.id === params.get("variant"))
  ? params.get("variant")
  : "journey";
let selectedDetail = {journey: "register", hub: "experiment"};
let contract;

const escapeHtml = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function source(id) {
  return contract.source_paths.find(item => item.id === id);
}

function checkpoint(id) {
  return contract.verification_checkpoints.find(item => item.id === id);
}

function checkpointBadge(id, compact = false) {
  const item = checkpoint(id);
  return [
    '<span class="checkpoint-badge', compact ? ' compact' : '', '">',
    '<b aria-hidden="true">✓</b>',
    '<span><strong>', escapeHtml(item.label), '</strong>',
    '<small>', escapeHtml(item.complete_when), '</small></span>',
    '</span>',
  ].join("");
}

function arrow(label = "") {
  return [
    '<span class="flow-arrow" aria-hidden="true">',
    label ? '<small>' + escapeHtml(label) + '</small>' : '',
    '<b>→</b></span>',
  ].join("");
}

function detailButton(key, className, title, body) {
  return [
    '<button class="', className, '" type="button" data-detail="', key, '">',
    '<strong>', escapeHtml(title), '</strong>',
    body ? '<span>' + escapeHtml(body) + '</span>' : '',
    '</button>',
  ].join("");
}

function detailItems() {
  const facility = contract.facility_transfer;
  const experimentId = contract.experiment_id_decision;
  return {
    "source-lab": {
      index: "STAGE 1 · SOURCE A",
      title: source("lab_instrument").label,
      body: source("lab_instrument").instruction,
      proof: "Continue only after recording and file writing have stopped.",
    },
    "source-facility": {
      index: "STAGE 1 · SOURCE B",
      title: source("shared_facility").label,
      body: facility.operations.join(" → "),
      proof: facility.assurance_boundary,
    },
    "experiment-known": {
      index: "STAGE 1 · EXPERIMENT ID",
      title: "Yes — I know the ID",
      body: experimentId.known.action,
      proof: "The ID links this Capture to the saved LabMate Experiment record.",
    },
    "experiment-unknown": {
      index: "STAGE 1 · EXPERIMENT ID",
      title: "No — register now",
      body: experimentId.unknown.registration_action + " Before upload: " +
        experimentId.unknown.before_web_upload.join(" "),
      proof: experimentId.not_equivalent,
    },
    "capture-gate": {
      index: "STAGE 1 · THREE YES GATE",
      title: "One coherent Capture",
      body: contract.capture_boundary.all_required.join(" "),
      proof: "If any answer is NO, split the selection before registration.",
    },
    register: {
      index: "STAGE 1 · COMPLETE",
      title: "Register one Capture",
      body: "Raw Data Register hashes the unchanged selected source files and writes the Capture manifest.",
      proof: checkpoint("raw_registered").label,
    },
    export: {
      index: "STAGE 2 · CHECKPOINT 1",
      title: "Export or copy one complete package",
      body: "Choose a destination for the complete CAP folder. Raw Data Register reopens the destination and verifies its bytes.",
      proof: checkpoint("local_export_verified").label,
    },
    upload: {
      index: "STAGE 2 · CHECKPOINT 2",
      title: "Choose the Experiment, upload and verify",
      body: "Desktop or Slack opens the same secure browser uploader. Select the Experiment and the outer CAP folder; do not ZIP it.",
      proof: checkpoint("transfer_integrity_confirmed").label,
    },
    explain: {
      index: "STAGE 2 · CHECKPOINT 3",
      title: "Explain this package",
      body: "Save the package’s scientific meaning while its source and acquisition are clear.",
      proof: checkpoint("explanation_complete").label,
    },
    "same-experiment": {
      index: "STAGE 2 · REPEAT",
      title: "Different data, same Experiment",
      body: contract.same_experiment_multiple_data.rule + " " +
        contract.same_experiment_multiple_data.loop,
      proof: contract.same_experiment_multiple_data.separate_capture_when.join(" "),
    },
    experiment: {
      index: "C2 · EXPERIMENT HUB",
      title: "One LabMate Experiment",
      body: "Raman data, fixture photographs, SEM data and other scientific sets may use the same Experiment ID.",
      proof: "Different source, session or scientific meaning remains a separate Capture and package.",
    },
    review: {
      index: "STAGE 3 · FINAL CHECK",
      title: "Review every data-set card",
      body: "Resolve missing explanations, answer the final Experiment questions and submit once.",
      proof: "Final submission waits until every intended package is verified and explained.",
    },
    receipt: {
      index: "STAGE 3 · COMPLETE",
      title: "Keep the Slack receipt",
      body: "The receipt and Receipt ID close this submission.",
      proof: checkpoint("slack_receipt").label,
    },
    additional: {
      index: "MORE DATA LATER",
      title: "Use Additional Data",
      body: contract.same_experiment_multiple_data.after_submission,
      proof: "Select the same Experiment; never reopen or replace the original submission.",
    },
  };
}

function readEmbeddedContract() {
  const node = document.getElementById("flow-contract");
  if (!node) throw new Error("The embedded prototype contract is missing.");
  return JSON.parse(node.textContent);
}

async function loadContract() {
  if (window.location.protocol === "file:") return readEmbeddedContract();
  const response = await fetch("flow-v1.json", {cache: "no-store"});
  if (!response.ok) throw new Error("The prototype contract could not be loaded.");
  return response.json();
}

async function boot() {
  contract = await loadContract();
  renderJourney();
  renderHub();
  renderFaq();
  wireStuckTool();
  wireDetailButtons();
  wireSwitcher();
  showVariant(currentVariant, false);
}

function renderJourney() {
  const facilitySteps = contract.facility_transfer.operations
    .map((item, index) => '<li><b>' + (index + 1) + '</b><span>' + escapeHtml(item) + '</span></li>')
    .join("");
  const gate = contract.capture_boundary.all_required
    .map((item, index) => '<li><b>YES ' + (index + 1) + '</b><span>' + escapeHtml(item) + '</span></li>')
    .join("");
  const beforeUpload = contract.experiment_id_decision.unknown.before_web_upload
    .slice(1, 3)
    .map(item => item.replace(/^Choose /, "").replace(/\.$/, ""))
    .join(" → ");
  const examples = contract.same_experiment_multiple_data.examples
    .map(item => '<span>' + escapeHtml(item) + '</span>').join("");

  document.getElementById("journey-root").innerHTML = [
    '<div class="journey-board">',
      '<section class="stage-lane stage-register" aria-labelledby="journey-stage-one">',
        '<header><span>1</span><div><p>REGISTER</p><h3 id="journey-stage-one">Protect the first BMDL-controlled copy</h3></div></header>',
        '<div class="source-branch">',
          detailButton("source-lab", "route-card", "LAB / OWN SETUP", "Recording stops → register on the acquisition computer."),
          detailButton("source-facility", "route-card facility-route", "SHARED FACILITY", "Unchanged originals → USB → your computer."),
        '</div>',
        '<ol class="facility-mini-path" aria-label="Shared facility transfer path">', facilitySteps, '</ol>',
        '<div class="merge-marker"><span>Both source routes meet here</span><b aria-hidden="true">↓</b></div>',
        '<article class="id-decision">',
          '<div class="decision-title"><span>DECISION</span><h3>Do you know the LabMate Experiment ID?</h3></div>',
          '<div class="decision-options">',
            detailButton("experiment-known", "decision-option yes", "YES — ENTER IT", contract.experiment_id_decision.known.action),
            detailButton("experiment-unknown", "decision-option no", "NO — REGISTER NOW", "Create the ID before browser upload: " + beforeUpload + "."),
          '</div>',
          '<p><strong>Important:</strong> ', escapeHtml(contract.experiment_id_decision.not_equivalent), '</p>',
        '</article>',
        '<article class="capture-gate">',
          '<div><p class="eyebrow">Before Register · all three must be YES</p><h3>One Capture gate</h3></div>',
          '<ol>', gate, '</ol>',
          detailButton("capture-gate", "text-link", "Why these three checks?", ""),
        '</article>',
        '<div class="stage-completion">',
          detailButton("register", "action-node", "REGISTER ONE CAPTURE", "Hash unchanged source files."),
          arrow(),
          checkpointBadge("raw_registered"),
        '</div>',
      '</section>',
      '<div class="stage-down"><b aria-hidden="true">↓</b><span>Move one verified package at a time</span></div>',
      '<section class="stage-lane stage-add" aria-labelledby="journey-stage-two">',
        '<header><span>2</span><div><p>ADD DATA</p><h3 id="journey-stage-two">Export, upload, verify and explain</h3></div></header>',
        '<div class="experiment-anchor"><span>ONE LABMATE EXPERIMENT</span><strong>[Experiment ID]</strong><small>Every package below can belong to this same Experiment.</small></div>',
        '<div class="package-process">',
          '<div class="process-stop">', detailButton("export", "action-node", "EXPORT / COPY PACKAGE", "Complete outer CAP folder."), checkpointBadge("local_export_verified"), '</div>',
          arrow(),
          '<div class="process-stop">', detailButton("upload", "action-node", "UPLOAD & VERIFY", "Choose the Experiment in the browser."), checkpointBadge("transfer_integrity_confirmed"), '</div>',
          arrow(),
          '<div class="process-stop">', detailButton("explain", "action-node", "EXPLAIN PACKAGE", "Save its scientific meaning."), checkpointBadge("explanation_complete"), '</div>',
        '</div>',
        '<article class="repeat-loop">',
          '<div><p class="eyebrow">Different data may share one Experiment</p><h3>More registered data for this Experiment?</h3>',
          '<div class="example-chips">', examples, '</div></div>',
          '<div class="repeat-decision"><strong>YES</strong><span>Add the next separate Capture/package and repeat Stage 2.</span><b aria-hidden="true">↩</b></div>',
          '<div class="repeat-decision done"><strong>NO</strong><span>Continue to final review.</span><b aria-hidden="true">↓</b></div>',
          detailButton("same-experiment", "text-link", "When must data be a separate Capture?", ""),
        '</article>',
      '</section>',
      '<div class="stage-down"><b aria-hidden="true">↓</b><span>Every intended package is verified and explained</span></div>',
      '<section class="stage-lane stage-review" aria-labelledby="journey-stage-three">',
        '<header><span>3</span><div><p>REVIEW &amp; SUBMIT</p><h3 id="journey-stage-three">Close the submission with a receipt</h3></div></header>',
        '<div class="stage-completion final">',
          detailButton("review", "action-node", "REVIEW EVERY DATA-SET CARD", "Resolve anything missing and submit."),
          arrow(),
          checkpointBadge("slack_receipt"),
        '</div>',
        '<article class="additional-route">',
          '<span>MORE DATA LATER?</span><strong>Register it → select the same Experiment → Additional Data</strong>',
          detailButton("additional", "text-link", "Why does this not change the original submission?", ""),
        '</article>',
      '</section>',
    '</div>',
  ].join("");
  renderDetail("journey", selectedDetail.journey);
}

function datasetCard(name, index) {
  return [
    '<button class="dataset-card" type="button" data-detail="same-experiment">',
      '<span class="dataset-number">DATA SET ', String(index + 1).padStart(2, "0"), '</span>',
      '<strong>', escapeHtml(name), '</strong>',
      '<small>Separate Capture + separate package</small>',
      '<span class="mini-proof"><i>✓ RAW</i><i>✓ EXPORT</i><i>✓ TRANSFER</i><i>✓ EXPLAIN</i></span>',
    '</button>',
  ].join("");
}

function renderHub() {
  const examples = contract.same_experiment_multiple_data.examples
    .map(datasetCard).join("");
  const gate = contract.capture_boundary.all_required
    .map(item => '<li><b>YES</b><span>' + escapeHtml(item) + '</span></li>').join("");

  document.getElementById("hub-root").innerHTML = [
    '<div class="hub-board">',
      '<section class="hub-intake" aria-labelledby="hub-intake-title">',
        '<header><span>1</span><div><p>REGISTER</p><h3 id="hub-intake-title">Bring each coherent data set in</h3></div></header>',
        detailButton("source-lab", "hub-route", "LAB / OWN SETUP", "Writing stops → register there."),
        detailButton("source-facility", "hub-route facility-route", "SHARED FACILITY", "Unchanged originals → USB → your computer → register."),
        '<article class="hub-id-card"><span>EXPERIMENT ID?</span><strong>YES: enter it</strong><strong>NO: register now</strong><small>Before upload: Slack Home → Record new experiment → Save &amp; continue.</small></article>',
        '<article class="hub-gate"><span>ONE CAPTURE · THREE YES ANSWERS</span><ol>', gate, '</ol></article>',
        checkpointBadge("raw_registered"),
      '</section>',
      '<div class="hub-arrow" aria-hidden="true">→</div>',
      '<section class="experiment-hub" aria-labelledby="experiment-hub-title">',
        '<button class="experiment-core" type="button" data-detail="experiment">',
          '<span>ONE LABMATE EXPERIMENT</span><strong id="experiment-hub-title">[Experiment ID]</strong>',
          '<small>Different data sets can all connect here.</small>',
        '</button>',
        '<div class="dataset-grid">', examples, '</div>',
        '<div class="hub-proof-chain" aria-label="Proof chain for every data set">',
          checkpointBadge("raw_registered", true),
          '<span aria-hidden="true">→</span>',
          checkpointBadge("local_export_verified", true),
          '<span aria-hidden="true">→</span>',
          checkpointBadge("transfer_integrity_confirmed", true),
          '<span aria-hidden="true">→</span>',
          checkpointBadge("explanation_complete", true),
        '</div>',
        '<p class="hub-rule"><strong>Separate Capture when:</strong> source/instrument, acquisition session or scientific meaning differs.</p>',
        '<button class="add-data-node" type="button" data-detail="same-experiment"><b>＋</b><span><strong>ADD ANOTHER REGISTERED DATA SET</strong><small>Same Experiment ID, separate Capture/package.</small></span></button>',
      '</section>',
      '<div class="hub-arrow" aria-hidden="true">→</div>',
      '<section class="hub-finish" aria-labelledby="hub-finish-title">',
        '<header><span>3</span><div><p>REVIEW &amp; SUBMIT</p><h3 id="hub-finish-title">Review the whole Experiment</h3></div></header>',
        '<ul><li>Every intended data-set card is present.</li><li>Every explanation is complete.</li><li>Final questions are answered.</li></ul>',
        detailButton("review", "action-node", "FINAL REVIEW & SUBMIT", ""),
        checkpointBadge("slack_receipt"),
      '</section>',
      '<article class="hub-additional">',
        '<span>MORE DATA AFTER THE RECEIPT?</span>',
        '<strong>Same Experiment → separate append-only Additional Data</strong>',
        detailButton("additional", "text-link", "Show the later-data rule", ""),
      '</article>',
    '</div>',
  ].join("");
  renderDetail("hub", selectedDetail.hub);
}

function renderDetail(scope, key) {
  const detail = detailItems()[key];
  const target = document.getElementById(scope + "-detail");
  target.innerHTML = [
    '<div><span class="node-index">', escapeHtml(detail.index), '</span>',
    '<h3>', escapeHtml(detail.title), '</h3>',
    '<p>', escapeHtml(detail.body), '</p></div>',
    '<div class="detail-proof"><span>CHECKPOINT / RULE</span><strong>', escapeHtml(detail.proof), '</strong></div>',
  ].join("");
}

function wireDetailButtons() {
  document.querySelectorAll("[data-detail]").forEach(button => {
    button.addEventListener("click", () => {
      const variant = button.closest(".variant");
      if (!variant) return;
      const scope = variant.dataset.variant;
      selectedDetail[scope] = button.dataset.detail;
      variant.querySelectorAll("[data-detail]").forEach(item => {
        item.classList.toggle("selected", item === button);
      });
      renderDetail(scope, selectedDetail[scope]);
      updatePrototypeState();
    });
  });
  document.querySelector('#variant-journey [data-detail="register"]')?.classList.add("selected");
  document.querySelector('#variant-hub [data-detail="experiment"]')?.classList.add("selected");
}

function renderFaq() {
  const topIds = new Set([
    "timing_lab", "timing_facility", "experiment_id_before_register",
    "experiment_id_create", "multiple_packages", "done",
  ]);
  const ordered = [
    ...contract.faq.filter(item => topIds.has(item.id)),
    ...contract.faq.filter(item => !topIds.has(item.id)),
  ];
  document.getElementById("faq-root").innerHTML = [
    '<div class="faq-list">',
    ordered.map((item, index) => [
      '<details', index === 0 ? ' open' : '', '>',
      '<summary>', escapeHtml(item.question), '</summary>',
      '<p>', escapeHtml(item.answer), '</p>',
      '</details>',
    ].join("")).join(""),
    '</div>',
  ].join("");
}

const stuckAnswers = {
  writing: {
    step: "Stage 1 · Register",
    title: "Wait. Do not register a file that is still changing.",
    body: "Leave the files where they are. Start registration as soon as recording and file writing have stopped.",
  },
  "no-id": {
    step: "Stage 1 · Experiment ID",
    title: "Choose NO and register now.",
    body: "Before browser upload, open Slack Home → Record new experiment → Save & continue. Plan an experiment is not the submission ID.",
  },
  facility: {
    step: "Stage 1 · Shared facility",
    title: "Keep the delivered originals unchanged.",
    body: "Copy them to USB, bring the USB to your own computer and register the delivered originals there promptly before renaming, converting or analysing them.",
  },
  upload: {
    step: "Stage 2 · Add data",
    title: "Keep the locally verified CAP package.",
    body: "Return through LabMate and continue or restart the browser upload. Offline registration and the exported package remain valid.",
  },
  receipt: {
    step: "Stage 3 · Review & submit",
    title: "You are not finished yet.",
    body: "Return to the Experiment, finish every package explanation and submit final review. Done means Slack shows a receipt and Receipt ID.",
  },
};

function wireStuckTool() {
  document.querySelectorAll("[data-stuck]").forEach(button => {
    button.addEventListener("click", () => {
      const answer = stuckAnswers[button.dataset.stuck];
      document.querySelectorAll("[data-stuck]").forEach(item => {
        item.classList.toggle("active", item === button);
      });
      document.getElementById("stuck-answer").innerHTML = [
        '<span>', escapeHtml(answer.step), '</span>',
        '<strong>', escapeHtml(answer.title), '</strong>',
        '<p>', escapeHtml(answer.body), '</p>',
      ].join("");
    });
  });
}

function wireSwitcher() {
  document.getElementById("previous-variant").addEventListener("click", () => cycleVariant(-1));
  document.getElementById("next-variant").addEventListener("click", () => cycleVariant(1));
  document.addEventListener("keydown", event => {
    const target = event.target;
    if (target instanceof Element && target.matches("input, textarea, [contenteditable]")) return;
    if (event.key === "ArrowLeft") cycleVariant(-1);
    if (event.key === "ArrowRight") cycleVariant(1);
  });
}

function cycleVariant(direction) {
  const currentIndex = VARIANTS.findIndex(item => item.id === currentVariant);
  const nextIndex = (currentIndex + direction + VARIANTS.length) % VARIANTS.length;
  showVariant(VARIANTS[nextIndex].id, true);
}

function showVariant(id, updateUrl) {
  currentVariant = id;
  document.querySelectorAll(".variant").forEach(section => {
    section.hidden = section.dataset.variant !== id;
  });
  const current = VARIANTS.find(item => item.id === id);
  document.getElementById("variant-label").textContent =
    current.key + " — " + current.name;
  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("variant", currentVariant);
    window.history.replaceState({}, "", url);
  }
  updatePrototypeState();
  const prototypeHost = ["localhost", "127.0.0.1", ""].includes(window.location.hostname) ||
    params.get("prototype") === "1";
  document.getElementById("prototype-switcher").hidden = !prototypeHost;
}

function updatePrototypeState() {
  const current = VARIANTS.find(item => item.id === currentVariant);
  const detail = detailItems()[selectedDetail[currentVariant]];
  document.getElementById("prototype-state").textContent =
    "Variant " + current.key + " · Selected: " + detail.title;
}

function renderBootError(error) {
  document.querySelectorAll(".variant").forEach(section => {
    section.hidden = section.dataset.variant !== "journey";
  });
  document.getElementById("journey-root").innerHTML =
    '<div class="boot-error"><strong>The prototype could not start.</strong><span>' +
    escapeHtml(String(error)) + '</span></div>';
}

boot().catch(renderBootError);
