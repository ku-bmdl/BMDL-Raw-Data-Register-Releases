# BMDL Raw Data Register Releases

Public, binary-only distribution infrastructure for BMDL Raw Data Register.
Application source code is maintained in a separate private repository.

- `release.published` validates signed assets and advances `pilot.json` or
  `stable.json` only to a higher SemVer.
- Stable releases update the branded page at
  `https://updates.bmdl.bio/raw-data-register/`.
- Prereleases update only the pilot feed and are not shown on the student
  download page.
- Published release assets are treated as immutable. A correction is always a
  higher patch release; channel pointers never downgrade.

DNS must point `updates.bmdl.bio` to GitHub Pages and HTTPS enforcement must
remain enabled.
