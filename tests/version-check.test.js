const test = require("node:test");
const assert = require("node:assert/strict");
const { newestRelease, parseVersion } = require("../src/electron/version-check");

test("版本号只接受本项目发布格式", () => {
  assert.deepEqual(parseVersion("0.3.0-preview.2"), [0, 3, 0, 2]);
  assert.equal(parseVersion("0.3.0-preview.2-extra"), null);
});

test("从公开 Release 中选择比当前版本新的最高版本", () => {
  const releases = [
    { tag_name: "v0.3.0-preview.1", draft: false },
    { tag_name: "v0.3.0-preview.3", draft: true },
    { tag_name: "v0.3.0-preview.2", draft: false },
    { tag_name: "not-a-version", draft: false },
    { tag_name: "v0.2.9", draft: false },
  ];
  assert.deepEqual(newestRelease(releases, "0.3.0-preview.1"), {
    version: "0.3.0-preview.2",
    url: "https://github.com/Ganzhib/taoqi-pet/releases/tag/v0.3.0-preview.2",
  });
  assert.equal(newestRelease(releases, "0.3.0-preview.2"), null);
});

test("正式版比相同编号的预览版新", () => {
  assert.equal(newestRelease([{ tag_name: "v0.3.0", draft: false }], "0.3.0-preview.9").version,
    "0.3.0");
});
