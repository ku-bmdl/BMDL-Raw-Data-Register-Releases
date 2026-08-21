import { readFileSync, writeFileSync } from "node:fs";
import { compareSemver, parseSemver } from "./publish-release.mjs";

function versionFromTag(tag) {
  if (!String(tag).startsWith("v")) throw new Error(`Release tag must start with v: ${tag}`);
  const version = tag.slice(1);
  parseSemver(version);
  return version;
}

export function selectChannelReleases(releases) {
  const selected = { pilot: null, stable: null };
  for (const release of releases) {
    if (release.isDraft || !release.publishedAt) continue;
    const channel = release.isPrerelease ? "pilot" : "stable";
    const version = versionFromTag(release.tagName);
    if (!selected[channel] || compareSemver(version, versionFromTag(selected[channel])) > 0) {
      selected[channel] = release.tagName;
    }
  }
  return selected;
}

if (process.argv[1]?.endsWith("select-channel-releases.mjs")) {
  try {
    const releases = JSON.parse(readFileSync(process.env.RELEASE_LIST_PATH || "release-list.json", "utf8"));
    const selected = selectChannelReleases(releases);
    const eventChannel = process.env.RELEASE_EVENT_PRERELEASE === "true" ? "pilot" : "stable";
    if (selected[eventChannel] !== process.env.RELEASE_EVENT_TAG) {
      throw new Error(
        `Published ${process.env.RELEASE_EVENT_TAG} is not newer than current ${eventChannel} release ${selected[eventChannel]}.`,
      );
    }
    writeFileSync(process.env.SELECTED_RELEASES_PATH || "selected-releases.json", `${JSON.stringify(selected, null, 2)}\n`);
    console.log(`Selected pilot=${selected.pilot || "none"} stable=${selected.stable || "none"}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
