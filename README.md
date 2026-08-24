# BMDL Raw Data Register Releases

Public, binary-only distribution infrastructure for BMDL Raw Data Register.
Application source code is maintained in a separate private repository.

The public GitHub release contains the notarized macOS DMG and the two signed
macOS Tauri updater files. Windows is distributed separately as an x64 MSIX by
[Microsoft Store](https://apps.microsoft.com/detail/9NTVDFKS4T1C) under Store
ID `9NTVDFKS4T1C`; Microsoft signs, hosts, and updates that package. The MSIX
submission candidate is never attached to a public GitHub release. Each public
release manifest must instead contain the matching certified Partner Center
submission provenance.

- `release.published` first stages the newest immutable release on `pilot.json`,
  validates the exact signed asset set, and rejects an older event. The
  organization-wide read-only workflow-token policy is preserved.
- `workflow_dispatch` is a pilot-only recovery path for the upstream GitHub
  Pages release-event build-version collision. It always rebuilds the newest
  published pilot and cannot enter either stable-promotion job.
- Prereleases stop at the pilot feed and are not shown on the student download
  page.
- A normal release waits behind the protected `stable-promotion` environment.
  After PI/admin approval, the exact same immutable assets advance `stable.json`
  and the branded student page. Successful environment deployments are the
  durable approval record used by later catalog rebuilds. Self-review is
  disabled and administrators cannot bypass the gate. Keep a second authorized
  reviewer configured when the release publisher is also a reviewer.
- Published release assets are treated as immutable. A correction is always a
  higher patch release; channel pointers never downgrade.
- Every manifest must include a GitHub evidence URL and a named controlled-host
  release operator. Pilot manifests may name that operator as approver; stable
  manifests must name a different approver.

DNS must point `updates.bmdl.bio` to GitHub Pages and HTTPS enforcement must
remain enabled.
