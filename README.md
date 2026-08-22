# BMDL Raw Data Register Releases

Public, binary-only distribution infrastructure for BMDL Raw Data Register.
Application source code is maintained in a separate private repository.

- `release.published` first stages the newest immutable release on `pilot.json`,
  validates the exact signed asset set, and rejects an older event. The
  organization-wide read-only workflow-token policy is preserved.
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
- Every manifest must include a GitHub evidence URL and name two distinct
  people as release approver and controlled-host release operator.

DNS must point `updates.bmdl.bio` to GitHub Pages and HTTPS enforcement must
remain enabled.
