import assert from "node:assert/strict";
import test from "node:test";

import { selectChannelReleases } from "./select-channel-releases.mjs";

test("highest published SemVer is selected independently for pilot and stable", () => {
  const selected = selectChannelReleases([
    { tagName: "v1.3.0-rc.1", isPrerelease: true, isDraft: false, publishedAt: "2026-08-01" },
    { tagName: "v1.3.0-rc.2", isPrerelease: true, isDraft: false, publishedAt: "2026-08-02" },
    { tagName: "v1.2.0", isPrerelease: false, isDraft: false, publishedAt: "2026-07-01" },
    { tagName: "v1.3.0", isPrerelease: false, isDraft: false, publishedAt: "2026-08-03" },
    { tagName: "v9.0.0", isPrerelease: false, isDraft: true, publishedAt: null },
  ]);
  assert.deepEqual(selected, { pilot: "v1.3.0-rc.2", stable: "v1.3.0" });
});
