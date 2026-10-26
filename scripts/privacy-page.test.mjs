import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const privacy = readFileSync("site/raw-data-register/privacy/index.html", "utf8");
const downloadPage = readFileSync("site/raw-data-register/index.html", "utf8");

test("privacy page states the Google Limited Use disclosure and scopes", () => {
  assert.match(privacy, /Google API Services User Data Policy/u);
  assert.match(privacy, /Limited Use requirements/u);
  assert.match(privacy, /<code>openid<\/code> and <code>email<\/code>/u);
  assert.match(privacy, /drive\.file/u);
  assert.match(privacy, /mailto:bmdl@ku\.edu\.tr/u);
});

test("privacy page loads no scripts and the download page links to it", () => {
  assert.doesNotMatch(privacy, /<script/u);
  assert.match(privacy, /script-src|default-src 'none'/u);
  assert.match(downloadPage, /href="privacy\/"/u);
});

test("1.5 privacy page matches what the app and server record now", () => {
  assert.doesNotMatch(privacy, /computer name itself is never sent/u, "the computer name is sent at sign-in since 1.5");
  assert.match(privacy, /computer name/u);
  assert.match(privacy, /refused/iu);
  assert.match(privacy, /email/iu);
  assert.match(privacy, /someone else's experiment/u);
  assert.match(privacy, /Effective 26 October 2026/u);
});

test("privacy page covers registers, integrations, audit, retention and controller", () => {
  assert.match(privacy, /up to five recently seen device names/u);
  assert.match(privacy, /up to 300 installed application names/u);
  assert.match(privacy, /Refused sign-ins/u);
  assert.match(privacy, /not on the laboratory member list/u);
  assert.match(privacy, /AI review requests/u);
  assert.match(privacy, /shared only with your Koç University account/u);
  assert.match(privacy, /Claude, an AI service from Anthropic/u);
  assert.match(privacy, /Anthropic \(Claude, for AI reviews\)/u);
  assert.match(privacy, /Anthropic does not use this data to train its models\./u);
  assert.match(privacy, /Confluence/u);
  assert.match(privacy, /screen navigation/u);
  assert.match(privacy, /audit/iu);
  assert.match(privacy, /kept for 5 years/u);
  assert.match(privacy, /does not delete stored records or files/u);
  assert.match(privacy, /Koç University, Bio-Integrated Microdevices Laboratory, Rumelifeneri Yolu, 34450 Sarıyer/u);
  assert.match(privacy, /https:\/\/www\.ku\.edu\.tr\/kisisel-verilerin-korunmasi\//u);
  assert.match(privacy, /gmail\.send/u);
  assert.match(privacy, /intended for authorized laboratory members/u);
});

test("privacy page drops claims that are no longer true", () => {
  assert.doesNotMatch(privacy, /never sent/u);
  assert.doesNotMatch(privacy, /never block an upload/u);
  assert.doesNotMatch(privacy, /no usage analytics/iu);
  assert.doesNotMatch(privacy, /usage analytics/iu);
  assert.doesNotMatch(privacy, /distributed only to/u);
  assert.doesNotMatch(privacy, /train AI/iu);
});
