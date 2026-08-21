const elements = {
  version: document.getElementById("release-version"),
  date: document.getElementById("release-date"),
  notes: document.getElementById("release-notes"),
  macosCard: document.getElementById("macos-card"),
  windowsCard: document.getElementById("windows-card"),
  macosDownload: document.getElementById("macos-download"),
  windowsDownload: document.getElementById("windows-download"),
  macosSha: document.getElementById("macos-sha"),
  windowsSha: document.getElementById("windows-sha"),
  technicalDetails: document.getElementById("technical-details"),
};

function recommendPlatform() {
  const platform = navigator.userAgent.toLowerCase().includes("windows") ? "windows" : navigator.userAgent.toLowerCase().includes("mac") ? "macos" : "";
  const card = platform === "windows" ? elements.windowsCard : platform === "macos" ? elements.macosCard : null;
  if (card) {
    card.classList.add("recommended");
    card.querySelector(".recommendation").hidden = false;
  }
}

function enableDownload(element, url) {
  element.href = url;
  element.classList.remove("disabled");
  element.removeAttribute("aria-disabled");
}

async function loadRelease() {
  recommendPlatform();
  try {
    const response = await fetch("release.json", { cache: "no-store", credentials: "omit" });
    if (!response.ok) throw new Error(`Release catalog returned ${response.status}`);
    const release = await response.json();
    elements.version.textContent = `Stable release · v${release.version}`;
    elements.date.textContent = `Published ${new Date(release.published_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`;
    elements.notes.textContent = release.notes || "";
    enableDownload(elements.macosDownload, release.downloads.macos.url);
    enableDownload(elements.windowsDownload, release.downloads.windows.url);
    elements.macosSha.textContent = release.downloads.macos.sha256;
    elements.windowsSha.textContent = release.downloads.windows.sha256;
    elements.technicalDetails.href = release.technical_details_url;
    elements.technicalDetails.hidden = false;
  } catch {
    elements.notes.textContent = "No stable installer is currently available. Registration already installed on an instrument computer continues to work offline.";
  }
}

void loadRelease();
