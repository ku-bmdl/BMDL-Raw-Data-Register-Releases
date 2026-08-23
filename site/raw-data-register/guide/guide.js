// Canonical read-only student guide. Answers remain in page memory only.
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
    source: null,
    ready: null,
    experimentReady: false,
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
  return contract.checkpoints.find(item => item.id === id);
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
      question: contract.capture_boundary.one_capture_when[captureIndex],
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

  if (!state.experimentReady) {
    return {
      id: "experiment-record",
      stage: 2,
      eyebrow: dataLabel + " · Verified browser",
      question: "How will you connect this package to an Experiment?",
      help: "After Google verifies your institutional account, select an existing Experiment or create a new one with the full form. Slack offers the same form but is optional.",
      options: [
        option("existing", "SELECT EXISTING EXPERIMENT", "Choose the matching Experiment in the browser.", "primary"),
        option("create", "CREATE NEW EXPERIMENT", "Create the record in the browser, or use Record new experiment in Slack."),
      ],
    };
  }

  if (!state.uploaded) {
    return {
      id: "upload",
      stage: 2,
      eyebrow: dataLabel + " · Browser checkpoint",
      question: "Choose the Experiment, upload and verify the package.",
      help: "The desktop or Slack opens the same secure uploader. A desktop CAP handoff takes the registered RAW path automatically. Select the outer CAP folder; do not ZIP it.",
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
      proof: checkpoint("final_receipt").label,
      options: [option("confirmed", "I HAVE THE FINAL RECEIPT", "Keep the Receipt ID. Slack will also deliver it.", "primary")],
    };
  }

  return {
    id: "done",
    stage: 3,
    eyebrow: "Submission complete",
    question: "Done — keep the Slack receipt and Receipt ID.",
    help: "If new data arrives later, select this same Experiment and use append-only Additional Data.",
    proof: checkpoint("final_receipt").label,
    options: [],
    done: true,
  };
}

function addHistory(stage, title, answer, tone = "complete") {
  flowState.history.push({stage, title, answer, tone, dataset: flowState.dataset});
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
  } else if (step.id === "experiment-record") {
    state.experimentReady = true;
    addHistory(2, "Experiment record", value === "existing" ? "Select existing in browser" : "Create in browser or Slack");
  } else if (step.id === "upload") {
    state.uploaded = true;
    addHistory(2, "Browser upload", checkpoint("transfer_integrity_confirmed").label);
  } else if (step.id === "explain") {
    state.explained = true;
    addHistory(2, "Package explanation", checkpoint("explanation_complete").label);
  } else if (step.id === "more-data") {
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
    addHistory(3, "Final review and submit", checkpoint("final_receipt").label);
  }

  renderInteractiveFlow();
  requestAnimationFrame(() => {
    document.querySelector('[data-current-step]')
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

function renderCurrentCard(step) {
  return [
    '<article class="flow-question ', step.tone || '', '" data-current-step>',
      '<p class="flow-kicker">STAGE ', step.stage, ' · ', escapeHtml(step.eyebrow), '</p>',
      '<h3>', escapeHtml(step.question), '</h3>',
      '<p class="flow-help">', escapeHtml(step.help), '</p>',
      step.proof ? checkpointPill(step.proof) : '',
      renderOptions(step),
    '</article>',
  ].join("");
}

function renderHistoryNode(item) {
  return [
    '<article class="flow-history-node ', item.tone === "stop" ? 'stopped' : '', '">',
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
    contract.stages.map(step => {
      const stateClass = step.number < activeStage ? "complete" : step.number === activeStage ? "current" : "future";
      return '<span class="' + stateClass + '"><b>' + step.number + '</b><strong>' + escapeHtml(step.label) + '</strong></span>';
    }).join('<i aria-hidden="true">→</i>') + '</div>';
}

function flowToolbar(step) {
  return [
    '<div class="flow-toolbar">',
      '<div><span>YOUR CURRENT PATH</span><strong>Data set ', String(flowState.dataset).padStart(2, "0"), ' · Stage ', step.stage, '</strong></div>',
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

function renderInteractiveFlow() {
  renderJourney();
  wireFlowControls();
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
        document.querySelector('[data-current-step]')
          ?.scrollIntoView({behavior: "smooth", block: "center"});
      });
    });
  });
}

function readEmbeddedContract() {
  const node = document.getElementById("flow-contract");
  if (!node) throw new Error("The embedded guide contract is missing.");
  const legacy = JSON.parse(node.textContent);
  const faq = (legacy.faq || []).map(item => {
    if (item.id === "experiment_id_create") return {
      ...item,
      question: "How do I create the Experiment?",
      answer: "Choose Create new experiment after the verified browser opens, or use Record new experiment in Slack. Both create the same record; Slack is optional.",
    };
    if (item.id === "slack_entry") return {
      ...item,
      question: "Do I have to use Slack?",
      answer: "No. The desktop opens the verified browser, where you can select or create the Experiment. Slack is an equal alternative.",
    };
    return item;
  });
  faq.push(
    {question: "Can I submit an Experiment with no files?", answer: "No. A registered-RAW submission needs at least one described data set."},
    {question: "Is the transfer-confirmed Slack message the final receipt?", answer: "No. It is a Stage 2 checkpoint. Complete every explanation and Stage 3 to receive the final Receipt ID."},
    {question: "What if I have supporting or processed files?", answer: "Choose Supporting / processed in LabMate. That path can add evidence to the Experiment but never claims RAW — REGISTERED."},
  );
  return {
    ...legacy,
    contract_version: "registered-raw-student-flow-v2",
    status: "active",
    stages: legacy.steps,
    capture_boundary: {
      ...legacy.capture_boundary,
      one_capture_when: legacy.capture_boundary.all_required,
    },
    checkpoints: legacy.verification_checkpoints.map(item =>
      item.id === "slack_receipt"
        ? {...item, id: "final_receipt", label: "FINAL RECEIPT"}
        : item),
    entry_rules: {
      desktop_experiment_id: "An Experiment ID is optional during offline desktop registration.",
      browser_identity: "Select or create the Experiment after institutional Google verification.",
    },
    data_kind_gate: {
      registered_raw: "A desktop CAP handoff automatically uses registered RAW.",
      supporting_or_processed: "Supporting or processed files never receive RAW — REGISTERED status.",
    },
    submission_rules: {
      at_least_one_data_set_required: true,
      context_only_submission_available: false,
    },
    faq,
  };
}

async function loadContract() {
  if (window.location.protocol === "file:") return readEmbeddedContract();
  const response = await fetch("flow-v2.json", {cache: "no-store"});
  if (!response.ok) throw new Error("The guide contract could not be loaded.");
  return response.json();
}

function renderFaq() {
  const ordered = contract.faq;
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
    step: "Stage 1 · Register now",
    title: "You do not need an ID for desktop registration.",
    body: "Register the unchanged files now. In the verified browser, select an existing Experiment or choose Create new experiment. Record new experiment in Slack is an equal alternative, not a prerequisite.",
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
    body: "The transfer-confirmed Slack message is only a Stage 2 checkpoint. Return to the Experiment, finish every package explanation and submit final review. Done means LabMate shows the final receipt and Slack delivers its Receipt ID.",
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

function renderBootError(error) {
  document.getElementById("journey-root").innerHTML =
    '<div class="boot-error"><strong>The guide could not start.</strong><span>' +
    escapeHtml(String(error)) + '</span></div>';
}

async function boot() {
  contract = await loadContract();
  renderInteractiveFlow();
  renderFaq();
  wireStuckTool();
}

boot().catch(renderBootError);
