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
