import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { compareSemver, parseSemver, publishRelease, validateApproval } from "./publish-release.mjs";

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

test("SemVer comparison only advances toward newer releases", () => {
  assert.equal(compareSemver("1.3.0-rc.2", "1.3.0-rc.1"), 1);
  assert.equal(compareSemver("1.3.0", "1.3.0-rc.2"), 1);
  assert.equal(compareSemver("1.3.1", "1.3.0"), 1);
  assert.equal(compareSemver("1.3.0", "1.3.0"), 0);
  assert.equal(compareSemver("1.2.9", "1.3.0"), -1);
});

test("invalid or partial versions are rejected", () => {
  for (const value of ["latest", "1.3", "01.3.0", "v1.3.0"]) {
    assert.throws(() => parseSemver(value), /Invalid SemVer/);
  }
});

test("pilot accepts single-operator evidence while stable requires an independent approver", () => {
  const approval = {
    approved_by: "release-operator",
    approved_at: "2026-08-20T10:00:00.000Z",
    reference: "https://github.com/ku-bmdl/private-release-approvals/issues/17",
    release_operator: "release-operator",
  };
  assert.equal(validateApproval(approval), approval);
  assert.throws(
    () => validateApproval(approval, { requireIndependent: true }),
    /approval evidence/,
  );
  assert.equal(
    validateApproval(
      { ...approval, approved_by: "stable-reviewer" },
      { requireIndependent: true },
    ).approved_by,
    "stable-reviewer",
  );
  assert.throws(
    () => validateApproval({ ...approval, reference: "http://example.com/17" }),
    /approval evidence/,
  );
});

test("a verified stable build can be staged on pilot then promoted unchanged", () => {
  const root = mkdtempSync(join(tmpdir(), "bmdl-release-test-"));
  const assetsDir = join(root, "assets");
  const siteDir = join(root, "site");
  mkdirSync(assetsDir);
  const version = "1.3.0";
  const tag = `v${version}`;
  const names = [
    `BMDL-Raw-Data-Register_${version}_universal.dmg`,
    `BMDL-Raw-Data-Register_${version}_universal.app.tar.gz`,
    `BMDL-Raw-Data-Register_${version}_universal.app.tar.gz.sig`,
  ];
  for (const name of names) writeFileSync(join(assetsDir, name), name.endsWith(".sig") ? "signature\n" : `bytes:${name}`);
  const base = `https://github.com/ku-bmdl/BMDL-Raw-Data-Register-Releases/releases/download/${tag}`;
  const feed = {
    version,
    notes: "Accepted release",
    pub_date: "2026-09-01T10:00:00.000Z",
    platforms: {
      "darwin-aarch64": { url: `${base}/${names[1]}`, signature: "signature" },
      "darwin-x86_64": { url: `${base}/${names[1]}`, signature: "signature" },
    },
  };
  const manifest = {
    manifest_version: "1.0",
    application_id: "edu.ku.bmdl.raw-data-register",
    application_version: version,
    channel: "stable",
    source_commit: "a".repeat(40),
    built_at: feed.pub_date,
    supported_manifest_schema_versions: ["1.0"],
    artifacts: names.map(name => ({
      name,
      size_bytes: readFileSync(join(assetsDir, name)).byteLength,
      sha256: sha256(join(assetsDir, name)),
    })),
    signing: {
      apple: { team_id: "TEAM", notarization_submission_id: "submission" },
      updater: { key_id: "key" },
    },
    distribution: {
      windows: {
        type: "microsoft_store_msix",
        store_id: "9NTVDFKS4T1C",
        product_url: "https://apps.microsoft.com/detail/9NTVDFKS4T1C",
        package_identity_name: "leventb.BMDLRawDataRegister",
        package_identity_publisher: "CN=EF6B9EC4-DC49-4498-A41D-05719C9D3681",
        publisher_display_name: "leventb",
        package_family_name: "leventb.BMDLRawDataRegister_b9aqxvjasx2jm",
        package_version: "1.3.99.0",
        submitted_candidate: {
          name: `BMDL-Raw-Data-Register_${version}_x64.msix`,
          size_bytes: 12345,
          sha256: "b".repeat(64),
        },
        certification: {
          submission_id: "submission-12345",
          certified_at: "2026-08-31T10:00:00.000Z",
          status: "certified",
        },
      },
    },
    approval: {
      approved_by: "pi-reviewer",
      approved_at: "2026-08-20T10:00:00.000Z",
      reference: "https://github.com/ku-bmdl/private-release-approvals/issues/17",
      release_operator: "release-operator",
    },
    release_status: "verified",
  };
  writeFileSync(join(assetsDir, "tauri-update.json"), `${JSON.stringify(feed)}\n`);
  writeFileSync(join(assetsDir, "release-manifest.json"), `${JSON.stringify(manifest)}\n`);
  const checksumNames = [...names, "release-manifest.json", "tauri-update.json"];
  writeFileSync(
    join(assetsDir, "SHA256SUMS.txt"),
    `${checksumNames.map(name => `${sha256(join(assetsDir, name))}  ${name}`).join("\n")}\n`,
  );
  const event = {
    release: { tag_name: tag, published_at: feed.pub_date, draft: false, prerelease: false },
  };

  try {
    assert.deepEqual(
      publishRelease({ event, assetsDir, siteDir, channelOverride: "pilot" }),
      { channel: "pilot", version },
    );
    assert.equal(JSON.parse(readFileSync(join(siteDir, "pilot.json"), "utf8")).version, version);
    assert.deepEqual(
      publishRelease({ event, assetsDir, siteDir, channelOverride: "stable" }),
      { channel: "stable", version },
    );
    assert.equal(JSON.parse(readFileSync(join(siteDir, "stable.json"), "utf8")).version, version);
    const catalog = JSON.parse(readFileSync(join(siteDir, "release.json"), "utf8"));
    assert.equal(catalog.downloads.windows.url, "https://apps.microsoft.com/detail/9NTVDFKS4T1C");
    assert.equal(catalog.downloads.windows.store_id, "9NTVDFKS4T1C");
    assert.equal(catalog.downloads.windows.certification_status, "certified");
    assert.equal(catalog.downloads.windows.sha256, undefined);
    writeFileSync(join(assetsDir, "unexpected.bin"), "unexpected");
    assert.throws(
      () => publishRelease({ event, assetsDir, siteDir: join(root, "other"), channelOverride: "stable" }),
      /missing or unexpected asset/u,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
