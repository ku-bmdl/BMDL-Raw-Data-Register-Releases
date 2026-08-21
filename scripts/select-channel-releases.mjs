import { readFileSync, writeFileSync } from "node:fs";
import { compareSemver, parseSemver } from "./publish-release.mjs";

function versionFromTag(tag) {
  if (!String(tag).startsWith("v")) throw new Error(`Release tag must start with v: ${tag}`);
  const version = tag.slice(1);
  parseSemver(version);
  return version;
}

export function selectChannelReleases(releases, approvedStableTags = new Set()) {
  const selected = { pilot: null, stable: null };
  for (const release of releases) {
    if (release.isDraft || !release.publishedAt) continue;
    const version = versionFromTag(release.tagName);
    if (!selected.pilot || compareSemver(version, versionFromTag(selected.pilot)) > 0) {
      selected.pilot = release.tagName;
    }
    if (
      !release.isPrerelease
      && approvedStableTags.has(release.tagName)
      && (!selected.stable || compareSemver(version, versionFromTag(selected.stable)) > 0)
    ) {
      selected.stable = release.tagName;
    }
  }
  return selected;
}

if (process.argv[1]?.endsWith("select-channel-releases.mjs")) {
  try {
    const releases = JSON.parse(readFileSync(process.env.RELEASE_LIST_PATH || "release-list.json", "utf8"));
    const approvedStableTags = new Set(
      readFileSync(process.env.APPROVED_STABLE_TAGS_PATH || "approved-stable-tags.txt", "utf8")
        .split(/\r?\n/u)
        .map(value => value.trim())
        .filter(Boolean),
    );
    const selected = selectChannelReleases(releases, approvedStableTags);
    if (selected.pilot !== process.env.RELEASE_EVENT_TAG) {
      throw new Error(
        `Published ${process.env.RELEASE_EVENT_TAG} is not the newest pilot candidate ${selected.pilot}.`,
      );
    }
    if (
      process.env.REQUIRE_STABLE_EVENT === "true"
      && selected.stable !== process.env.RELEASE_EVENT_TAG
    ) throw new Error(`Release ${process.env.RELEASE_EVENT_TAG} does not have a successful stable-promotion approval.`);
    writeFileSync(process.env.SELECTED_RELEASES_PATH || "selected-releases.json", `${JSON.stringify(selected, null, 2)}\n`);
    console.log(`Selected pilot=${selected.pilot || "none"} stable=${selected.stable || "none"}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
