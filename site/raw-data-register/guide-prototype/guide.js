const VARIANTS = [
  {id: "cards", key: "A", name: "Linear cards"},
  {id: "wizard", key: "B", name: "Guided wizard"},
  {id: "map", key: "C", name: "Interactive map"},
];

const params = new URLSearchParams(window.location.search);
let currentVariant = VARIANTS.some(item => item.id === params.get("variant"))
  ? params.get("variant")
  : "wizard";
let wizardState = {screen: "source", source: null, packages: 2, splitHelp: false};
let selectedMapNode = "register";
let contract;

const escapeHtml = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const checklists = {
  register: [
    "Wait until file writing is completely finished.",
    "Use the acquisition computer when possible—this includes a custom board or software recording on your own computer; keep a facility delivery unchanged.",
    "Choose files from one Experiment, source/session and scientific meaning.",
    "Choose NO if the Experiment ID does not exist yet; do not delay registration.",
  ],
  add_data: [
    "Prepare and locally verify one complete CAP package.",
    "Select the correct Experiment in the secure browser uploader.",
    "Wait for transfer-integrity confirmation, then explain that package.",
    "Choose Add another registered package when more data belongs to the Experiment.",
  ],
  review_submit: [
    "Check every data-set card and resolve any missing explanation.",
    "Answer the final Experiment questions.",
    "Submit once, then keep the Slack receipt and Receipt ID.",
  ],
};

const stuckAnswers = {
  writing: {
    step: "Step 1 · Register",
    title: "Wait. Do not register a file that is still changing.",
    body: "Leave the files where they are. Start registration as soon as the instrument finishes writing all files in the acquisition.",
  },
  "no-id": {
    step: "Step 1 · Register",
    title: "Choose NO and register now.",
    body: "An Experiment ID is not required for offline registration. Create or find the Experiment record before you start browser upload.",
  },
  facility: {
    step: "Step 1 · Register",
    title: "Keep the original delivery unchanged.",
    body: "Register it on the first BMDL-controlled computer immediately after receipt, before renaming, reorganising, converting or analysing it.",
  },
  upload: {
    step: "Step 2 · Add data",
    title: "Keep the verified CAP package.",
    body: "Select the outer CAP folder containing manifest.json and RAW/. If transfer stopped, return through LabMate and continue or restart; registration remains valid.",
  },
  receipt: {
    step: "Step 3 · Review & submit",
    title: "You are not finished yet.",
    body: "Return to the Experiment, finish every package explanation and submit the final review. Done means Slack shows a receipt and Receipt ID.",
  },
};

const mapNodes = {
  "source-lab": {
    index: "STEP 1 · SOURCE A",
    title: "Lab instrument, custom board or your own computer",
    body: "Wait until recording and file writing finish, then register on that acquisition computer before the first copy whenever possible.",
    proof: "Continue when the acquisition is closed and the selected source files are no longer changing.",
  },
  "source-facility": {
    index: "STEP 1 · SOURCE B",
    title: "Shared or core facility",
    body: "Keep the delivered originals unchanged. Register them on the first BMDL-controlled computer immediately after receipt.",
    proof: "RAW — REGISTERED begins at your registration boundary; it does not verify what happened inside the facility.",
  },
  register: {
    index: "STEP 1 OF 3",
    title: "Register one coherent Capture",
    body: "One Experiment, one source and acquisition session, and one data set that you would explain together. File extensions do not decide the boundary.",
    proof: "Done when the desktop application shows RAW — REGISTERED.",
  },
  package: {
    index: "STEP 2 · CHECKPOINT 1",
    title: "Prepare one complete package",
    body: "Copy the complete CAP folder and let the desktop application reopen and verify the destination bytes.",
    proof: "Continue when the application shows LOCAL PACKAGE VERIFIED.",
  },
  verify: {
    index: "STEP 2 · CHECKPOINT 2",
    title: "Upload and verify",
    body: "Upload one package at a time through the secure browser. Select the outer CAP folder, not RAW/ by itself and not a ZIP.",
    proof: "Continue when LabMate shows TRANSFER INTEGRITY CONFIRMED.",
  },
  explain: {
    index: "STEP 2 · CHECKPOINT 3",
    title: "Explain this package now",
    body: "Describe its scientific meaning while the source and acquisition are still clear. Another package unlocks after this explanation is saved.",
    proof: "The data-set card must show that its explanation is complete.",
  },
  more: {
    index: "STEP 2 · REPEAT",
    title: "More data for this Experiment?",
    body: "Choose Add another registered package and repeat package → verify → explain. Different sources or sessions remain separate Captures.",
    proof: "If data arrives after final submission, LabMate creates a separate Additional Data submission.",
  },
  review: {
    index: "STEP 3 OF 3",
    title: "Review every data-set card",
    body: "Check that the Raman data, fixture images, SEM data or other sets are separate where their source/session or scientific meaning differs.",
    proof: "Final submit unlocks only when every required explanation is complete.",
  },
  receipt: {
    index: "COMPLETE",
    title: "Keep the Slack receipt",
    body: "The receipt closes this submission. It does not prevent later data from being added through a separate append-only submission.",
    proof: "Done means Slack shows a receipt and Receipt ID.",
  },
};

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
  renderCards();
  renderWizard();
  renderMap();
  renderFaq();
  wireStuckTool();
  wireSwitcher();
  showVariant(currentVariant, false);
}

function renderCards() {
  const root = document.getElementById("cards-root");
  const cards = contract.steps.map(step => `
    <article class="step-card">
      <p class="step-number">STEP ${step.number} OF 3 · ${escapeHtml(step.label)}</p>
      <h3>${escapeHtml(step.title)}</h3>
      <p class="step-summary">${escapeHtml(step.summary)}</p>
      <ul class="mini-checklist">
        ${checklists[step.id].map(item => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
      <div class="done-when"><strong>Done when</strong><span>${escapeHtml(step.complete_when)}</span></div>
    </article>`).join("");
  const sources = contract.source_paths.map(source => `
    <article><strong>${escapeHtml(source.label)}</strong><p>${escapeHtml(source.instruction)}</p></article>`).join("");
  const requirements = contract.capture_boundary.all_required
    .map(item => `<li>${escapeHtml(item)}</li>`).join("");
  const examples = contract.capture_boundary.examples.slice(0, 4).map(example => {
    const split = example.decision !== "one_capture";
    return `<div class="boundary-example ${split ? "split" : ""}"><strong>${split ? "SPLIT" : "ONE CAPTURE"}</strong><br>${escapeHtml(example.files)}</div>`;
  }).join("");
  const loop = contract.add_data_loop.operations
    .map((operation, index) => `${index ? '<span class="loop-arrow" aria-hidden="true">→</span>' : ""}<span class="loop-stop">${escapeHtml(operation)}</span>`)
    .join("");
  root.innerHTML = `
    <div class="source-split">${sources}</div>
    <div class="boundary-panel">
      <h3>One Capture only when all three statements are true</h3>
      <ol>${requirements}</ol>
      <div class="boundary-examples">${examples}</div>
    </div>
    <div class="cards-overview">${cards}</div>
    <div class="loop-panel">
      <p class="eyebrow">Step 2 repeats</p>
      <h3>One package at a time; one explanation before the next</h3>
      <div class="loop-strip">${loop}</div>
      <p class="later-loop"><strong>More data later?</strong> Select the same Experiment. LabMate creates or resumes a separate append-only Additional Data submission.</p>
    </div>`;
}

function renderWizard() {
  const root = document.getElementById("wizard-root");
  const screens = {
    source: wizardSource,
    boundary: wizardBoundary,
    register: wizardRegister,
    add: wizardAddData,
    review: wizardReview,
  };
  root.innerHTML = screens[wizardState.screen]();
  const step = ["source", "boundary", "register"].includes(wizardState.screen)
    ? 1 : wizardState.screen === "add" ? 2 : 3;
  const label = contract.steps[step - 1].label;
  document.getElementById("wizard-step-label").textContent = `Step ${step} of 3 · ${label}`;
  document.getElementById("wizard-progress").value = step;
  wireWizardActions();
  updatePrototypeState();
}

function wizardFrame(question, help, body, kicker = "One short decision") {
  return `<div class="wizard-screen">
    <div class="wizard-question"><p class="eyebrow">${escapeHtml(kicker)}</p><h3>${escapeHtml(question)}</h3>${body}</div>
    <aside class="wizard-help"><strong>Why this matters</strong><p>${escapeHtml(help)}</p></aside>
  </div>`;
}

function wizardSource() {
  return wizardFrame(
    "Where did these original files come from?",
    "The earliest safe registration point is different for a lab instrument and a shared facility delivery.",
    `<p>Choose the route that describes the unchanged originals in front of you.</p>
     <div class="wizard-choices">
       <button class="wizard-choice" type="button" data-wizard-source="lab_instrument"><strong>LAB INSTRUMENT OR OWN SETUP</strong><br>An instrument, custom board or software is recording them on this computer.</button>
       <button class="wizard-choice" type="button" data-wizard-source="shared_facility"><strong>SHARED OR CORE FACILITY</strong><br>I received the original delivery from another facility.</button>
     </div>`);
}

function wizardBoundary() {
  const source = contract.source_paths.find(item => item.id === wizardState.source);
  return wizardFrame(
    "Do these selected files form one Capture?",
    "A Capture is a scientific boundary, not a file-extension bucket. Similar CSV files can belong to different Experiments; different file types can belong together when one acquisition produced them.",
    `<p><strong>${escapeHtml(source?.label)}</strong> · ${escapeHtml(source?.instruction)}</p>
     <div class="boundary-checks">
       ${contract.capture_boundary.all_required.map((item, index) => `<label><input type="checkbox" data-boundary-check="${index}"><span>${escapeHtml(item)}</span></label>`).join("")}
     </div>
     <button id="boundary-continue" class="primary-action" type="button" disabled>YES — THIS IS ONE CAPTURE</button>
     <button class="secondary-action" type="button" data-wizard-action="split">NO / I’M NOT SURE</button>
     ${wizardState.splitHelp ? `<div class="wizard-alert"><strong>Split the selection.</strong><br>Different Experiment means a separate Experiment record. Different source, session or scientific meaning means a separate Capture.</div>` : ""}`);
}

function wizardRegister() {
  return wizardFrame(
    "Do you already know the LabMate Experiment ID?",
    "The ID links the package later. It must not delay offline registration.",
    `<p>Wait until file writing is finished. Register promptly before renaming, editing, converting or analysing anything.</p>
     <div class="wizard-choices">
       <button class="wizard-choice" type="button" data-wizard-action="registered"><strong>YES — I HAVE THE ID</strong><br>Enter the Experiment ID in Raw Data Register.</button>
       <button class="wizard-choice" type="button" data-wizard-action="registered"><strong>NO — I DO NOT HAVE IT YET</strong><br>Register now. Create or find the Experiment record before browser upload.</button>
     </div>`,
    "Step 1 · Register");
}

function wizardAddData() {
  const samples = [
    ["Raman measurement", "CAP package verified and explained"],
    ["Fixture photographs", "CAP package verified and explained"],
  ];
  while (samples.length < wizardState.packages) {
    samples.push([`Additional data set ${samples.length + 1}`, "CAP package verified and explained"]);
  }
  return wizardFrame(
    "Does more registered data belong to this Experiment?",
    "Upload and explain one package before adding the next. This keeps each explanation attached to the correct source and acquisition.",
    `<p>Both Slack and the desktop application can open the secure browser uploader. Google sign-in and file transfer remain in the browser.</p>
     <div class="data-set-stack">
       ${samples.map(([name, status]) => `<div class="data-set-row"><b>✓</b><div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(status)}</span></div><em>Complete</em></div>`).join("")}
     </div>
     <div class="wizard-choices">
       <button class="wizard-choice" type="button" data-wizard-action="add-package"><strong>ADD ANOTHER REGISTERED PACKAGE</strong><br>Prepare → upload & verify → explain.</button>
       <button class="primary-action" type="button" data-wizard-action="review">NO MORE DATA — REVIEW & SUBMIT</button>
     </div>`,
    "Step 2 · Add data");
}

function wizardReview() {
  return wizardFrame(
    "Can you see a Slack receipt and Receipt ID?",
    "Transfer confirmation is not final submission. The receipt proves that the review was submitted and closes this submission.",
    `<p>Check every data-set card, resolve any missing explanation and answer the final questions.</p>
     <div class="done-when"><strong>Done when</strong><span>Slack shows a receipt and Receipt ID.</span></div>
     <div class="wizard-choices">
       <button class="primary-action" type="button" data-wizard-action="restart">REVIEW THE GUIDE AGAIN</button>
     </div>
     <p class="wizard-alert"><strong>More data later?</strong> Register the new data and select the same Experiment. LabMate keeps the original submission unchanged and opens Additional Data.</p>`,
    "Step 3 · Review & submit");
}

function wireWizardActions() {
  document.querySelectorAll("[data-wizard-source]").forEach(button => {
    button.addEventListener("click", () => {
      wizardState = {...wizardState, source: button.dataset.wizardSource, screen: "boundary", splitHelp: false};
      renderWizard();
    });
  });
  const boundaryChecks = [...document.querySelectorAll("[data-boundary-check]")];
  const boundaryContinue = document.getElementById("boundary-continue");
  boundaryChecks.forEach(input => input.addEventListener("change", () => {
    boundaryContinue.disabled = !boundaryChecks.every(item => item.checked);
  }));
  boundaryContinue?.addEventListener("click", () => {
    wizardState = {...wizardState, screen: "register", splitHelp: false};
    renderWizard();
  });
  document.querySelectorAll("[data-wizard-action]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.wizardAction;
      if (action === "split") wizardState = {...wizardState, splitHelp: true};
      if (action === "registered") wizardState = {...wizardState, screen: "add"};
      if (action === "add-package") wizardState = {...wizardState, packages: wizardState.packages + 1};
      if (action === "review") wizardState = {...wizardState, screen: "review"};
      if (action === "restart") wizardState = {screen: "source", source: null, packages: 2, splitHelp: false};
      renderWizard();
    });
  });
}

function renderMap() {
  const root = document.getElementById("map-root");
  root.innerHTML = `
    <span class="map-label step-one">Step 1 · Register</span>
    <span class="map-label step-two">Step 2 · Add data</span>
    <span class="map-label step-three">Step 3</span>
    <span class="map-connector merge-a" aria-hidden="true"></span>
    <span class="map-connector merge-b" aria-hidden="true"></span>
    <span class="map-connector main-one" aria-hidden="true"></span>
    <span class="map-connector main-two" aria-hidden="true"></span>
    <span class="map-connector main-three" aria-hidden="true"></span>
    <span class="map-connector main-four" aria-hidden="true"></span>
    <button class="map-node source-lab" data-map-node="source-lab" type="button">Lab / own setup</button>
    <button class="map-node source-facility" data-map-node="source-facility" type="button">Shared facility</button>
    <button class="map-node register" data-map-node="register" type="button">Register one Capture</button>
    <button class="map-node package" data-map-node="package" type="button">Prepare package</button>
    <button class="map-node verify" data-map-node="verify" type="button">Upload & verify</button>
    <button class="map-node explain" data-map-node="explain" type="button">Explain package</button>
    <button class="map-node more" data-map-node="more" type="button">More data? Repeat Step 2</button>
    <button class="map-node review" data-map-node="review" type="button">Review & submit</button>
    <button class="map-node receipt" data-map-node="receipt" type="button">Slack receipt</button>`;
  root.querySelectorAll("[data-map-node]").forEach(button => {
    button.addEventListener("click", () => {
      selectedMapNode = button.dataset.mapNode;
      renderMapDetail();
      root.querySelectorAll("[data-map-node]").forEach(item => item.classList.toggle("selected", item === button));
      updatePrototypeState();
    });
  });
  renderMapDetail();
  root.querySelector(`[data-map-node="${selectedMapNode}"]`)?.classList.add("selected");
}

function renderMapDetail() {
  const detail = mapNodes[selectedMapNode];
  document.getElementById("map-detail").innerHTML = `
    <span class="node-index">${escapeHtml(detail.index)}</span>
    <h3>${escapeHtml(detail.title)}</h3>
    <p>${escapeHtml(detail.body)}</p>
    <div class="map-proof"><strong>${escapeHtml(detail.proof)}</strong></div>`;
}

function renderFaq() {
  const topIds = new Set(["timing_lab", "timing_facility", "capture_boundary", "multiple_packages", "done"]);
  const ordered = [...contract.faq.filter(item => topIds.has(item.id)), ...contract.faq.filter(item => !topIds.has(item.id))];
  document.getElementById("faq-root").innerHTML = `<div class="faq-list">${ordered.map((item, index) => `
    <details ${index === 0 ? "open" : ""}>
      <summary>${escapeHtml(item.question)}</summary>
      <p>${escapeHtml(item.answer)}</p>
    </details>`).join("")}</div>`;
}

function wireStuckTool() {
  document.querySelectorAll("[data-stuck]").forEach(button => {
    button.addEventListener("click", () => {
      const answer = stuckAnswers[button.dataset.stuck];
      document.querySelectorAll("[data-stuck]").forEach(item => item.classList.toggle("active", item === button));
      document.getElementById("stuck-answer").innerHTML = `
        <span>${escapeHtml(answer.step)}</span>
        <strong>${escapeHtml(answer.title)}</strong>
        <p>${escapeHtml(answer.body)}</p>`;
    });
  });
}

function wireSwitcher() {
  document.getElementById("previous-variant").addEventListener("click", () => cycleVariant(-1));
  document.getElementById("next-variant").addEventListener("click", () => cycleVariant(1));
  window.addEventListener("keydown", event => {
    const target = event.target;
    if (target instanceof HTMLElement && (target.matches("input, textarea") || target.isContentEditable)) return;
    if (event.key === "ArrowLeft") cycleVariant(-1);
    if (event.key === "ArrowRight") cycleVariant(1);
  });
  const prototypeHost = ["", "localhost", "127.0.0.1"].includes(window.location.hostname)
    || params.get("prototype") === "1";
  document.getElementById("prototype-switcher").hidden = !prototypeHost;
}

function cycleVariant(direction) {
  const index = VARIANTS.findIndex(item => item.id === currentVariant);
  const next = VARIANTS[(index + direction + VARIANTS.length) % VARIANTS.length];
  showVariant(next.id, true);
}

function showVariant(variantId, scroll) {
  currentVariant = variantId;
  document.querySelectorAll("[data-variant]").forEach(section => {
    section.hidden = section.dataset.variant !== currentVariant;
  });
  const url = new URL(window.location.href);
  url.searchParams.set("variant", currentVariant);
  window.history.replaceState({}, "", url);
  const variant = VARIANTS.find(item => item.id === currentVariant);
  document.getElementById("variant-label").textContent = `${variant.key} — ${variant.name}`;
  updatePrototypeState();
  if (scroll) document.querySelector(".prototype-context").scrollIntoView({behavior: "smooth", block: "start"});
}

function updatePrototypeState() {
  const variant = VARIANTS.find(item => item.id === currentVariant);
  let detail = "Full journey visible";
  if (currentVariant === "wizard") detail = `Wizard screen: ${wizardState.screen}`;
  if (currentVariant === "map") detail = `Selected node: ${selectedMapNode}`;
  document.getElementById("prototype-state").textContent = `Variant ${variant.key} · ${detail}`;
}

boot().catch(error => {
  document.querySelector("main").insertAdjacentHTML("afterbegin", `<div class="wizard-alert"><strong>Prototype unavailable.</strong> ${escapeHtml(error.message)}</div>`);
});
