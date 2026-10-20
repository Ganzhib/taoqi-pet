const test = require("node:test");
const assert = require("node:assert/strict");
const {
  configureUpdaterChannel,
  isPreviewVersion,
  newestRelease,
  parseVersion,
  releaseDownloadUrl,
  releasesFromAtom,
  updateChannel,
} = require("../src/electron/version-check");

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

test("Release Feed 只提取项目版本标签并标记预览版", () => {
  const feed = `<feed>
    <link href="https://github.com/Ganzhib/taoqi-pet/releases"/>
    <entry><link href="https://github.com/Ganzhib/taoqi-pet/releases/tag/v0.4.1"/></entry>
    <entry><link href="https://github.com/Ganzhib/taoqi-pet/releases/tag/v0.4.2-preview.3"/></entry>
    <entry><link href="https://github.com/Ganzhib/taoqi-pet/releases/tag/not-a-version"/></entry>
    <entry><link href="https://github.com/Ganzhib/taoqi-pet/releases/tag/v0.4.1"/></entry>
  </feed>`;
  assert.deepEqual(releasesFromAtom(feed), [
    { tag_name: "v0.4.1", draft: false, prerelease: false },
    { tag_name: "v0.4.2-preview.3", draft: false, prerelease: true },
  ]);
});

test("安装版更新地址直接指向候选 Release", () => {
  assert.equal(
    releaseDownloadUrl("0.4.4"),
    "https://github.com/Ganzhib/taoqi-pet/releases/download/v0.4.4/",
  );
  assert.throws(() => releaseDownloadUrl("latest"), /版本号/);
});

test("正式版比相同编号的预览版新", () => {
  assert.equal(newestRelease([{ tag_name: "v0.3.0", draft: false }], "0.3.0-preview.9").version,
    "0.3.0");
});

test("正式版只跟随 latest 通道并忽略预览版", () => {
  const releases = [
    { tag_name: "v0.4.0-preview.1", draft: false, prerelease: true },
    { tag_name: "v0.3.2", draft: false, prerelease: false },
  ];
  assert.equal(isPreviewVersion("0.3.1"), false);
  assert.equal(updateChannel("0.3.1"), "latest");
  assert.equal(newestRelease(releases, "0.3.1").version, "0.3.2");
  assert.equal(newestRelease([releases[0]], "0.3.1"), null);
  assert.equal(newestRelease([
    { tag_name: "v0.3.3", draft: false, prerelease: true },
  ], "0.3.1"), null);
});

test("预览版跟随 preview 通道并可升级到正式版", () => {
  const releases = [
    { tag_name: "v0.3.2-preview.2", draft: false, prerelease: true },
    { tag_name: "v0.3.2", draft: false, prerelease: false },
  ];
  assert.equal(isPreviewVersion("0.3.2-preview.1"), true);
  assert.equal(updateChannel("0.3.2-preview.1"), "preview");
  assert.equal(newestRelease(releases, "0.3.2-preview.1").version, "0.3.2");
});

test("设置更新渠道后再次关闭降级", () => {
  const updater = {
    set channel(value) {
      this.selectedChannel = value;
      this.allowDowngrade = true;
    },
  };
  configureUpdaterChannel(updater, "latest");
  assert.equal(updater.selectedChannel, "latest");
  assert.equal(updater.allowPrerelease, false);
  assert.equal(updater.allowDowngrade, false);
});
