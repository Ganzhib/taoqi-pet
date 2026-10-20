const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "site", "main.js"), "utf8");

async function renderWithAssets(assetNames) {
  const releaseVersion = { textContent: "v0.4.1" };
  const releasePage = {
    href: "https://github.com/Ganzhib/taoqi-pet/releases/tag/v0.4.1",
    textContent: "v0.4.1 官方 GitHub Release",
  };
  const links = ["windows-installer", "windows-portable", "mac-arm64", "mac-x64"]
    .map((key) => ({ dataset: { releaseAsset: key }, href: "fallback-" + key }));
  const selectors = new Map([
    ["#hero-pet", {}],
    ["#hero-symbol", {}],
    ["#hero-caption", {}],
    ["#release-version", releaseVersion],
    ["#release-page", releasePage],
  ]);
  const document = {
    querySelector: (selector) => selectors.get(selector),
    querySelectorAll: (selector) => selector === "[data-release-asset]" ? links : [],
    documentElement: { classList: { toggle: () => {} } },
  };
  const window = {
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  };
  const assets = assetNames.map((name) => ({
    name,
    browser_download_url: "https://downloads.example/" + name,
  }));
  const fetch = async () => ({
    ok: true,
    json: async () => ({
      tag_name: "v0.4.2",
      html_url: "https://github.com/Ganzhib/taoqi-pet/releases/tag/v0.4.2",
      assets,
    }),
  });

  vm.runInNewContext(source, { document, window, fetch, Map });
  await new Promise((resolve) => setImmediate(resolve));
  return { links, releasePage, releaseVersion };
}

test("官网在四个平台资产齐全后整体切换到最新正式版", async () => {
  const names = [
    "taoqi-pet-setup-0.4.2-win-x64.exe",
    "taoqi-pet-portable-0.4.2-win-x64.exe",
    "taoqi-pet-0.4.2-mac-arm64.dmg",
    "taoqi-pet-0.4.2-mac-x64.dmg",
  ];
  const page = await renderWithAssets(names);
  assert.equal(page.releaseVersion.textContent, "v0.4.2");
  assert.equal(page.releasePage.href, "https://github.com/Ganzhib/taoqi-pet/releases/tag/v0.4.2");
  assert.deepEqual(page.links.map((link) => link.href),
    names.map((name) => "https://downloads.example/" + name));
});

test("官网在安装包不齐时保留内置稳定版链接", async () => {
  const page = await renderWithAssets([
    "taoqi-pet-setup-0.4.2-win-x64.exe",
    "taoqi-pet-portable-0.4.2-win-x64.exe",
    "taoqi-pet-0.4.2-mac-arm64.dmg",
  ]);
  assert.equal(page.releaseVersion.textContent, "v0.4.1");
  assert.equal(page.releasePage.href, "https://github.com/Ganzhib/taoqi-pet/releases/tag/v0.4.1");
  assert.deepEqual(page.links.map((link) => link.href), [
    "fallback-windows-installer",
    "fallback-windows-portable",
    "fallback-mac-arm64",
    "fallback-mac-x64",
  ]);
});
