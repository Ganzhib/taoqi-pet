const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { TOOLBOX_URL, CHARACTERS, detectImageType, isValidCustomPet, clampToWorkArea } = require("../src/electron/pet-core");

test("pet stays visible on a display with a negative origin", () => {
  const area = { x: -1920, y: 0, width: 1920, height: 1080 };
  const next = clampToWorkArea({ x: -2200, y: 900, width: 240, height: 280 }, area);
  assert.deepEqual(next, { x: -1920, y: 800, width: 240, height: 280 });
});

test("pet remains within a work area smaller than the window", () => {
  const area = { x: 100, y: 50, width: 150, height: 160 };
  const next = clampToWorkArea({ x: 400, y: 300, width: 240, height: 280 }, area);
  assert.deepEqual(next, { x: 100, y: 50, width: 240, height: 280 });
});

test("toolbox address carries only fixed source parameters", () => {
  const url = new URL(TOOLBOX_URL);
  assert.equal(url.origin, "https://next.ganzhibin.icu");
  assert.equal(url.searchParams.get("utm_source"), "taoqi_pet");
  assert.deepEqual([...url.searchParams.keys()], ["utm_source", "utm_medium", "utm_content"]);
});

test("every built-in character has local artwork", () => {
  for (const character of CHARACTERS) {
    const artwork = path.join(__dirname, "..", "assets", "pets", character.id + ".svg");
    assert.ok(fs.statSync(artwork).size > 0, character.name);
  }
});

test("custom imports accept supported raster signatures and reject SVG", () => {
  assert.equal(detectImageType(Buffer.from("89504e470d0a1a0a", "hex")).extension, "png");
  assert.equal(detectImageType(Buffer.from("ffd8ff", "hex")).extension, "jpg");
  assert.equal(detectImageType(Buffer.from("GIF89a", "ascii")).extension, "gif");
  assert.equal(detectImageType(Buffer.from("RIFF0000WEBP", "ascii")).extension, "webp");
  assert.equal(detectImageType(Buffer.from("<svg></svg>", "utf8")), null);
});

test("saved custom pet IDs cannot address paths outside the pet directory", () => {
  assert.equal(isValidCustomPet({
    id: "custom-12345678-1234-1234-1234-123456789abc",
    name: "我的宠物",
    extension: "png",
  }), true);
  assert.equal(isValidCustomPet({
    id: "custom-../../private",
    name: "bad",
    extension: "png",
  }), false);
});
