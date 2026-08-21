import assert from "node:assert/strict";
import test from "node:test";

import { selectChannelReleases } from "./select-channel-releases.mjs";

test("pilot takes the newest build while stable requires a recorded approval", () => {
  const releases = [
    { tagName: "v1.3.0-rc.1", isPrerelease: true, isDraft: false, publishedAt: "2026-08-01" },
    { tagName: "v1.3.0-rc.2", isPrerelease: true, isDraft: false, publishedAt: "2026-08-02" },
    { tagName: "v1.2.0", isPrerelease: false, isDraft: false, publishedAt: "2026-07-01" },
    { tagName: "v1.3.0", isPrerelease: false, isDraft: false, publishedAt: "2026-08-03" },
    { tagName: "v9.0.0", isPrerelease: false, isDraft: true, publishedAt: null },
  ];
  assert.deepEqual(selectChannelReleases(releases), { pilot: "v1.3.0", stable: null });
  assert.deepEqual(
    selectChannelReleases(releases, new Set(["v1.2.0"])),
    { pilot: "v1.3.0", stable: "v1.2.0" },
  );
  assert.deepEqual(
    selectChannelReleases(releases, new Set(["v1.2.0", "v1.3.0"])),
    { pilot: "v1.3.0", stable: "v1.3.0" },
  );
});
