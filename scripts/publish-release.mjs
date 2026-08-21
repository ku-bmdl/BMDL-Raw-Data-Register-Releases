import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const applicationId = "edu.ku.bmdl.raw-data-register";
const repository = "ku-bmdl/BMDL-Raw-Data-Register-Releases";
const supportedPlatforms = ["darwin-aarch64", "darwin-x86_64", "windows-x86_64"];
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export function parseSemver(value) {
  const match = semverPattern.exec(String(value || ""));
  if (!match) throw new Error(`Invalid SemVer: ${value}`);
  return {
    core: match.slice(1, 4).map(Number),
    prerelease: match[4] ? match[4].split(".") : [],
  };
}

export function compareSemver(leftValue, rightValue) {
  const left = parseSemver(leftValue);
  const right = parseSemver(rightValue);
  for (let index = 0; index < 3; index += 1) {
    if (left.core[index] !== right.core[index]) return left.core[index] > right.core[index] ? 1 : -1;
  }
  if (!left.prerelease.length || !right.prerelease.length) {
    return left.prerelease.length === right.prerelease.length ? 0 : left.prerelease.length ? -1 : 1;
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined || rightPart === undefined) return leftPart === undefined ? -1 : 1;
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) return Number(leftPart) > Number(rightPart) ? 1 : -1;
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart > rightPart ? 1 : -1;
  }
  return 0;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function validateFeed(feed, tag) {
  parseSemver(feed.version);
  if (feed.notes != null && (typeof feed.notes !== "string" || feed.notes.length > 2_000)) {
    throw new Error("Release notes are invalid.");
  }
  if (feed.pub_date != null && Number.isNaN(Date.parse(feed.pub_date))) {
    throw new Error("Publication date is invalid.");
  }
  const platforms = Object.keys(feed.platforms || {}).sort();
  if (JSON.stringify(platforms) !== JSON.stringify([...supportedPlatforms].sort())) {
    throw new Error("Updater feed does not contain the complete supported platform set.");
  }
  for (const [platform, artifact] of Object.entries(feed.platforms)) {
    const url = new URL(artifact.url);
    if (
      url.protocol !== "https:"
      || url.hostname !== "github.com"
      || !url.pathname.startsWith(`/${repository}/releases/download/${tag}/`)
    ) throw new Error(`Untrusted updater URL for ${platform}.`);
    if (typeof artifact.signature !== "string" || !artifact.signature.trim()) {
      throw new Error(`Missing updater signature for ${platform}.`);
    }
  }
}

function validateChecksums(assetsDir, manifest) {
  for (const artifact of manifest.artifacts || []) {
    const path = join(assetsDir, basename(artifact.name));
    if (!existsSync(path)) throw new Error(`Manifest asset is missing: ${artifact.name}`);
    if (readFileSync(path).byteLength !== artifact.size_bytes || sha256(path) !== artifact.sha256) {
      throw new Error(`Manifest checksum or size mismatch: ${artifact.name}`);
    }
  }
  const checksumLines = readFileSync(join(assetsDir, "SHA256SUMS.txt"), "utf8").trim().split("\n");
  for (const line of checksumLines) {
    const match = /^([0-9a-f]{64})  ([^/]+)$/.exec(line);
    if (!match) throw new Error("SHA256SUMS.txt contains an invalid line.");
    const path = join(assetsDir, match[2]);
    if (!existsSync(path) || sha256(path) !== match[1]) throw new Error(`SHA256SUMS mismatch: ${match[2]}`);
  }
}

export function publishRelease({ event, assetsDir, siteDir }) {
  const release = event.release;
  if (!release?.published_at || release.draft) throw new Error("Only a published, non-draft release can update a channel.");
  const tag = release.tag_name;
  const feed = readJson(join(assetsDir, "tauri-update.json"));
  const manifest = readJson(join(assetsDir, "release-manifest.json"));
  const channel = release.prerelease ? "pilot" : "stable";
  validateFeed(feed, tag);
  validateChecksums(assetsDir, manifest);

  if (tag !== `v${feed.version}` || manifest.application_version !== feed.version) {
    throw new Error("Release tag, feed version, and manifest version must match.");
  }
  if (
    manifest.application_id !== applicationId
    || manifest.channel !== channel
    || manifest.release_status !== "verified"
  ) throw new Error("Release manifest identity, channel, or verification status is invalid.");
  if (channel === "stable" && feed.version.includes("-")) {
    throw new Error("A prerelease version cannot advance the stable channel.");
  }

  mkdirSync(siteDir, { recursive: true });
  const pointerPath = join(siteDir, `${channel}.json`);
  if (existsSync(pointerPath)) {
    const current = readJson(pointerPath);
    if (compareSemver(feed.version, current.version) <= 0) {
      throw new Error(`${channel}.json cannot move backward or repeat ${current.version}.`);
    }
  }
  writeFileSync(pointerPath, `${JSON.stringify(feed, null, 2)}\n`);

  if (channel === "stable") {
    const artifacts = Object.fromEntries(manifest.artifacts.map(artifact => [artifact.name, artifact]));
    const dmgName = Object.keys(artifacts).find(name => name.endsWith("_universal.dmg"));
    const windowsName = Object.keys(artifacts).find(name => name.endsWith("_x64-setup.exe"));
    if (!dmgName || !windowsName) throw new Error("Stable release is missing a manual installer.");
    const base = `https://github.com/${repository}/releases/download/${tag}`;
    const catalog = {
      version: feed.version,
      published_at: feed.pub_date || release.published_at,
      notes: feed.notes || "",
      downloads: {
        macos: { url: `${base}/${dmgName}`, sha256: artifacts[dmgName].sha256 },
        windows: { url: `${base}/${windowsName}`, sha256: artifacts[windowsName].sha256 },
      },
      technical_details_url: `https://github.com/${repository}/releases/tag/${tag}`,
    };
    writeFileSync(join(siteDir, "release.json"), `${JSON.stringify(catalog, null, 2)}\n`);
  }
  return { channel, version: feed.version };
}

if (process.argv[1]?.endsWith("publish-release.mjs")) {
  try {
    const result = publishRelease({
      event: readJson(process.env.GITHUB_EVENT_PATH),
      assetsDir: process.env.RELEASE_ASSETS_DIR || "release-assets",
      siteDir: process.env.RELEASE_SITE_DIR || "site/raw-data-register",
    });
    console.log(`Published ${result.channel} pointer ${result.version}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
