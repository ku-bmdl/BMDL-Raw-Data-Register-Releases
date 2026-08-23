const VARIANTS = [
  {id: "journey", key: "C1", name: "Guided journey"},
  {id: "hub", key: "C2", name: "Growing flow map"},
];

const params = new URLSearchParams(window.location.search);
let currentVariant = VARIANTS.some(item => item.id === params.get("variant"))
  ? params.get("variant")
  : "journey";
let contract;
let flowState = createFlowState();

const escapeHtml = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function createFlowState() {
  return {
    dataset: 1,
    history: [],
    completedDatasets: [],
    source: null,
    ready: null,
    idKnown: null,
    idCreated: false,
    captureAnswers: [null, null, null],
    captureNeedsSplit: false,
    registered: false,
    exported: false,
    uploaded: false,
    explained: false,
    moreData: null,
    submitted: false,
  };
}

function checkpoint(id) {
  return contract.verification_checkpoints.find(item => item.id === id);
}

function option(value, label, detail = "", tone = "") {
  return {value, label, detail, tone};
}

function currentStep() {
  const state = flowState;
  const dataLabel = "Data set " + String(state.dataset).padStart(2, "0");

  if (!state.source) {
    return {
      id: "source",
      stage: 1,
      eyebrow: dataLabel + " · Start here",
      question: "Where did these files come from?",
      help: "Choose the computer or facility that produced the unchanged original files.",
      options: [
        option("local", "LAB / OWN COMPUTER", "Instrument, custom board or software recorded them here."),
        option("facility", "SHARED FACILITY", "The facility delivered the original files to you."),
      ],
    };
  }

  if (state.ready === null) {
    const facility = state.source === "facility";
    return {
      id: "ready",
      stage: 1,
      eyebrow: dataLabel + " · Protect the original",
      question: facility
        ? "Are the delivered originals unchanged on your computer?"
        : "Have recording and file writing completely stopped?",
      help: facility
        ? "Facility originals unchanged → copy to USB → bring to your computer → register promptly."
        : "Register on the acquisition computer before the first copy whenever possible.",
      options: [
        option("yes", "YES — CONTINUE", "The original files are ready to register.", "primary"),
        option("no", "NO — STOP HERE", "Do not register files that are still changing or have already been altered.", "stop"),
      ],
    };
  }

  if (state.ready === "no") {
    return {
      id: "ready-resume",
      stage: 1,
      eyebrow: dataLabel + " · Safe pause",
      question: "Wait here. Do not change or register the files yet.",
      help: state.source === "facility"
        ? "Return when the unchanged facility delivery is on your computer via USB."
        : "Return when acquisition and file writing have fully stopped.",
      options: [option("resume", "THE FILES ARE READY NOW", "Continue with the unchanged originals.", "primary")],
      tone: "stop",
    };
  }

  if (state.idKnown === null) {
    return {
      id: "experiment-id",
      stage: 1,
      eyebrow: dataLabel + " · Experiment link",
      question: "Do you know the LabMate Experiment ID?",
      help: "You may register offline without an ID. The ID is required before browser upload.",
      options: [
        option("yes", "YES — I KNOW IT", "Enter the saved Experiment ID in Raw Data Register.", "primary"),
        option("no", "NO — REGISTER WITHOUT IT", "The Slack ID step will appear before upload."),
      ],
    };
  }

  if (state.captureNeedsSplit) {
    return {
      id: "capture-split",
      stage: 1,
      eyebrow: dataLabel + " · Capture boundary",
      question: "Split the selection before registration.",
      help: "Different Experiment, source, acquisition session or scientific meaning means a separate Capture.",
      options: [option("split", "I SEPARATED THE FILES", "Run the three checks again.", "primary")],
      tone: "stop",
    };
  }

  const captureIndex = state.captureAnswers.findIndex(answer => answer === null);
  if (captureIndex >= 0) {
    return {
      id: "capture-" + captureIndex,
      stage: 1,
      eyebrow: dataLabel + " · Capture check " + (captureIndex + 1) + " of 3",
      question: contract.capture_boundary.all_required[captureIndex],
      help: "All three answers must be YES before these files become one Capture.",
      options: [
        option("yes", "YES", "This condition is true.", "primary"),
        option("no", "NO", "Split the selection before registration.", "stop"),
      ],
    };
  }

  if (!state.registered) {
    return {
      id: "register",
      stage: 1,
      eyebrow: dataLabel + " · Desktop checkpoint",
      question: "Register this Capture in Raw Data Register.",
      help: "Hash the unchanged source files. Continue only when the desktop app shows the checkpoint below.",
      proof: checkpoint("raw_registered").label,
      options: [option("confirmed", "I SEE RAW — REGISTERED", "Stage 1 is complete for this data set.", "primary")],
    };
  }

  if (!state.exported) {
    return {
      id: "export",
      stage: 2,
      eyebrow: dataLabel + " · Package checkpoint",
      question: "Export or copy one complete CAP package.",
      help: "Use the complete outer CAP folder. Continue only after the desktop app verifies the destination bytes.",
      proof: checkpoint("local_export_verified").label,
      options: [option("confirmed", "I SEE LOCAL EXPORT VERIFIED", "The package is ready for browser upload.", "primary")],
    };
  }

  if (state.idKnown === "no" && !state.idCreated) {
    return {
      id: "create-id",
      stage: 2,
      eyebrow: dataLabel + " · Required before upload",
      question: "Create the Experiment ID in Slack now.",
      help: "Slack Home → Record new experiment → Save & continue. Plan an experiment does not create this ID.",
      options: [option("confirmed", "I NOW HAVE THE EXPERIMENT ID", "Use it when the uploader asks where this package belongs.", "primary")],
    };
  }

  if (!state.uploaded) {
    return {
      id: "upload",
      stage: 2,
      eyebrow: dataLabel + " · Browser checkpoint",
      question: "Choose the Experiment, upload and verify the package.",
      help: "Desktop or Slack opens the same secure uploader. Select the outer CAP folder; do not ZIP it.",
      proof: checkpoint("transfer_integrity_confirmed").label,
      options: [option("confirmed", "I SEE TRANSFER INTEGRITY CONFIRMED", "The uploaded bytes match the registered fingerprints.", "primary")],
    };
  }

  if (!state.explained) {
    return {
      id: "explain",
      stage: 2,
      eyebrow: dataLabel + " · Scientific context",
      question: "Explain this package before adding another one.",
      help: "Save what this coherent data set means while its source and acquisition are clear.",
      proof: checkpoint("explanation_complete").label,
      options: [option("confirmed", "EXPLANATION COMPLETE", "This data-set card is complete.", "primary")],
    };
  }

  if (state.moreData === null) {
    return {
      id: "more-data",
      stage: 2,
      eyebrow: dataLabel + " · Loop decision",
      question: "Is there another registered data set for this Experiment?",
      help: "Different source, session or scientific meaning stays in a separate Capture and package, but may use the same Experiment ID.",
      options: [
        option("yes", "YES — ADD ANOTHER", "Return to Stage 1 for the next data set.", "primary"),
        option("no", "NO — FINAL REVIEW", "Continue to Stage 3."),
      ],
    };
  }

  if (!state.submitted) {
    return {
      id: "review",
      stage: 3,
      eyebrow: "Whole Experiment · Final check",
      question: "Review every data-set card and submit once.",
      help: "Resolve missing explanations, answer the final questions and wait for the Slack receipt.",
      proof: checkpoint("slack_receipt").label,
      options: [option("confirmed", "I HAVE THE SLACK RECEIPT", "Keep the Receipt ID. The submission is complete.", "primary")],
    };
  }

  return {
    id: "done",
    stage: 3,
    eyebrow: "Submission complete",
    question: "Done — keep the Slack receipt and Receipt ID.",
    help: "If new data arrives later, select this same Experiment and use append-only Additional Data.",
    proof: checkpoint("slack_receipt").label,
    options: [],
    done: true,
  };
}

function addHistory(stage, title, answer, tone = "complete") {
  flowState.history.push({stage, title, answer, tone, dataset: flowState.dataset});
}

function finishCurrentDataset() {
  if (!flowState.completedDatasets.includes(flowState.dataset)) {
    flowState.completedDatasets.push(flowState.dataset);
  }
}

function handleChoice(value) {
  const step = currentStep();
  const state = flowState;

  if (step.id === "source") {
    state.source = value;
    addHistory(1, "Source", value === "facility" ? "Shared facility" : "Lab / own computer");
  } else if (step.id === "ready") {
    state.ready = value;
    addHistory(1, "Original files ready?", value === "yes" ? "YES — unchanged and ready" : "NO — wait", value === "yes" ? "complete" : "stop");
  } else if (step.id === "ready-resume") {
    state.ready = "yes";
    addHistory(1, "Safe pause", "Files are ready now");
  } else if (step.id === "experiment-id") {
    state.idKnown = value;
    addHistory(1, "Experiment ID known?", value === "yes" ? "YES — enter it" : "NO — create before upload");
  } else if (step.id === "capture-split") {
    state.captureNeedsSplit = false;
    state.captureAnswers = [null, null, null];
    addHistory(1, "Capture selection", "Files separated — check again");
  } else if (step.id.startsWith("capture-")) {
    const index = Number(step.id.split("-")[1]);
    if (value === "no") {
      state.captureNeedsSplit = true;
      addHistory(1, "Capture check " + (index + 1), "NO — split the selection", "stop");
    } else {
      state.captureAnswers[index] = "yes";
      addHistory(1, "Capture check " + (index + 1), "YES");
    }
  } else if (step.id === "register") {
    state.registered = true;
    addHistory(1, "Desktop registration", checkpoint("raw_registered").label);
  } else if (step.id === "export") {
    state.exported = true;
    addHistory(2, "Package export", checkpoint("local_export_verified").label);
  } else if (step.id === "create-id") {
    state.idCreated = true;
    state.idKnown = "yes";
    addHistory(2, "Slack Experiment record", "Experiment ID created");
  } else if (step.id === "upload") {
    state.uploaded = true;
    addHistory(2, "Browser upload", checkpoint("transfer_integrity_confirmed").label);
  } else if (step.id === "explain") {
    state.explained = true;
    addHistory(2, "Package explanation", checkpoint("explanation_complete").label);
  } else if (step.id === "more-data") {
    finishCurrentDataset();
    if (value === "yes") {
      addHistory(2, "More data for this Experiment?", "YES — loop to another separate data set");
      state.dataset += 1;
      state.source = null;
      state.ready = null;
      state.captureAnswers = [null, null, null];
      state.captureNeedsSplit = false;
      state.registered = false;
      state.exported = false;
      state.uploaded = false;
      state.explained = false;
      state.moreData = null;
    } else {
      state.moreData = "no";
      addHistory(2, "More data for this Experiment?", "NO — continue to final review");
    }
  } else if (step.id === "review") {
    state.submitted = true;
    addHistory(3, "Final review and submit", checkpoint("slack_receipt").label);
  }

  renderInteractiveFlow();
  requestAnimationFrame(() => {
    document.querySelector('.variant:not([hidden]) [data-current-step]')
      ?.scrollIntoView({behavior: "smooth", block: "center"});
  });
}

function checkpointPill(label) {
  return '<span class="flow-proof"><b aria-hidden="true">✓</b>' + escapeHtml(label) + '</span>';
}

function renderOptions(step) {
  if (step.done) {
    return '<button class="restart-button" type="button" data-flow-reset>START AGAIN</button>';
  }
  return '<div class="flow-options">' + step.options.map(item => [
    '<button class="flow-choice ', escapeHtml(item.tone), '" type="button" data-flow-choice="', escapeHtml(item.value), '">',
      '<strong>', escapeHtml(item.label), '</strong>',
      item.detail ? '<span>' + escapeHtml(item.detail) + '</span>' : '',
    '</button>',
  ].join("")).join("") + '</div>';
}

function renderCurrentCard(step, compact = false) {
  return [
    '<article class="flow-question ', compact ? 'compact ' : '', step.tone || '', '" data-current-step>',
      '<p class="flow-kicker">STAGE ', step.stage, ' · ', escapeHtml(step.eyebrow), '</p>',
      '<h3>', escapeHtml(step.question), '</h3>',
      '<p class="flow-help">', escapeHtml(step.help), '</p>',
      step.proof ? checkpointPill(step.proof) : '',
      renderOptions(step),
    '</article>',
  ].join("");
}

function renderHistoryNode(item, compact = false) {
  return [
    '<article class="flow-history-node ', compact ? 'compact ' : '', item.tone === "stop" ? 'stopped' : '', '">',
      '<span>DATA SET ', String(item.dataset).padStart(2, "0"), ' · STAGE ', item.stage, '</span>',
      '<strong>', escapeHtml(item.title), '</strong>',
      '<small>', escapeHtml(item.answer), '</small>',
    '</article>',
  ].join("");
}

function downArrow(label = "") {
  return '<div class="flow-arrow-down" aria-hidden="true"><b>↓</b>' +
    (label ? '<span>' + escapeHtml(label) + '</span>' : '') + '</div>';
}

function stageMeter(activeStage) {
  return '<div class="interactive-stage-meter" aria-label="Three submission stages">' +
    contract.steps.map(step => {
      const stateClass = step.number < activeStage ? "complete" : step.number === activeStage ? "current" : "future";
      return '<span class="' + stateClass + '"><b>' + step.number + '</b><strong>' + escapeHtml(step.label) + '</strong></span>';
    }).join('<i aria-hidden="true">→</i>') + '</div>';
}

function flowToolbar(step) {
  return [
    '<div class="flow-toolbar">',
      '<div><span>LIVE PROTOTYPE STATE</span><strong>Data set ', String(flowState.dataset).padStart(2, "0"), ' · Stage ', step.stage, '</strong></div>',
      '<button type="button" data-flow-reset>Start over</button>',
    '</div>',
  ].join("");
}

function renderJourney() {
  const step = currentStep();
  const trail = flowState.history.map((item, index) =>
    renderHistoryNode(item) + (index < flowState.history.length - 1 ? downArrow() : "")
  ).join("");

  document.getElementById("journey-root").innerHTML = [
    '<div class="guided-flow">',
      flowToolbar(step),
      stageMeter(step.stage),
      '<div class="guided-path" aria-live="polite">',
        '<article class="flow-start"><span>START</span><strong>One unchanged data set</strong></article>',
        downArrow("Answer only what you see"),
        trail,
        trail ? downArrow("Next appropriate step") : '',
        renderCurrentCard(step),
      '</div>',
      '<p class="progress-note"><strong>', flowState.history.length, ' answers recorded in memory.</strong> Future steps stay hidden until your answer makes them relevant.</p>',
    '</div>',
  ].join("");
}

function experimentHubSummary() {
  const examples = contract.same_experiment_multiple_data.examples
    .map(item => '<span>' + escapeHtml(item) + '</span>').join("");
  const datasets = flowState.completedDatasets
    .map(number => '<b>✓ DATA SET ' + String(number).padStart(2, "0") + '</b>')
    .join("");
  return [
    '<article class="experiment-flow-hub">',
      '<span>ONE LABMATE EXPERIMENT</span><strong>[Experiment ID]</strong>',
      '<small>Separate Captures and packages can all connect to this same record.</small>',
      '<div class="hub-examples" aria-label="Example data sets">', examples, '</div>',
      datasets ? '<div class="completed-datasets">' + datasets + '</div>' : '',
    '</article>',
  ].join("");
}

function renderStageLane(stageNumber, step) {
  const stage = contract.steps.find(item => item.number === stageNumber);
  const events = flowState.history.filter(item => item.stage === stageNumber);
  const current = step.stage === stageNumber;
  const nodes = [];

  if (stageNumber === 2) nodes.push(experimentHubSummary());
  events.forEach(item => nodes.push(renderHistoryNode(item, true)));
  if (current) nodes.push(renderCurrentCard(step, true));

  return [
    '<section class="map-stage-lane ', current ? 'current' : 'complete', '" aria-label="Stage ', stageNumber, '">',
      '<header><b>', stageNumber, '</b><div><span>STAGE ', stageNumber, '</span><strong>', escapeHtml(stage.label), '</strong></div></header>',
      '<div class="map-node-path">',
        nodes.map((node, index) => node + (index < nodes.length - 1 ? downArrow() : "")).join(""),
      '</div>',
    '</section>',
  ].join("");
}

function renderHub() {
  const step = currentStep();
  const maxHistoryStage = Math.max(1, ...flowState.history.map(item => item.stage));
  const maxStage = Math.max(step.stage, maxHistoryStage);
  const lanes = [];

  for (let stage = 1; stage <= maxStage; stage += 1) {
    lanes.push(renderStageLane(stage, step));
    if (stage < maxStage) {
      const connectorLabel = step.stage <= stage
        ? "Earlier data remains linked"
        : "Stage " + stage + " complete";
      lanes.push('<div class="stage-connector" aria-hidden="true"><b>→</b><span>' + connectorLabel + '</span></div>');
    }
  }

  document.getElementById("hub-root").innerHTML = [
    '<div class="growing-map">',
      flowToolbar(step),
      stageMeter(step.stage),
      '<div class="map-stage-grid" aria-live="polite">', lanes.join(""), '</div>',
      flowState.completedDatasets.length && step.stage === 1
        ? '<div class="loop-marker"><b>↺</b><span>Another data set selected: the flow safely returns to Stage 1 and keeps the same Experiment ID.</span></div>'
        : '',
      '<p class="progress-note"><strong>Only reached stages are visible.</strong> Answer the highlighted node to grow the map.</p>',
    '</div>',
  ].join("");
}

function renderInteractiveFlow() {
  renderJourney();
  renderHub();
  wireFlowControls();
  updatePrototypeState();
}

function wireFlowControls() {
  document.querySelectorAll("[data-flow-choice]").forEach(button => {
    button.addEventListener("click", () => handleChoice(button.dataset.flowChoice));
  });
  document.querySelectorAll("[data-flow-reset]").forEach(button => {
    button.addEventListener("click", () => {
      flowState = createFlowState();
      renderInteractiveFlow();
      requestAnimationFrame(() => {
        document.querySelector('.variant:not([hidden]) [data-current-step]')
          ?.scrollIntoView({behavior: "smooth", block: "center"});
      });
    });
  });
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
  document.getElementById("variant-label").textContent = current.key + " — " + current.name;
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
  if (!contract) return;
  const current = VARIANTS.find(item => item.id === currentVariant);
  const step = currentStep();
  document.getElementById("prototype-state").textContent =
    "Variant " + current.key + " · Stage " + step.stage + " · " + step.question;
}

function renderBootError(error) {
  document.querySelectorAll(".variant").forEach(section => {
    section.hidden = section.dataset.variant !== "journey";
  });
  document.getElementById("journey-root").innerHTML =
    '<div class="boot-error"><strong>The prototype could not start.</strong><span>' +
    escapeHtml(String(error)) + '</span></div>';
}

async function boot() {
  contract = await loadContract();
  renderInteractiveFlow();
  renderFaq();
  wireStuckTool();
  wireSwitcher();
  showVariant(currentVariant, false);
}

boot().catch(renderBootError);
