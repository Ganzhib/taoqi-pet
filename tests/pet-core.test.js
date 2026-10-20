const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  TOOLBOX_URL,
  DEFAULT_CHARACTER_ID,
  GUGUGAGA_STATES,
  DEFAULT_GUGUGAGA_STATE_ID,
  CHARACTERS,
  MOVEMENT_MODES,
  detectImageType,
  isAnimatedImage,
  isValidCustomPet,
  resolveCharacterId,
  resolveMovementMode,
  resolveGugugagaStateId,
  clampToWorkArea,
  nextFollowBounds,
} = require("../src/electron/pet-core");

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

test("咕咕嘎嘎是默认角色，内置目录只保留一只猫", () => {
  assert.equal(DEFAULT_CHARACTER_ID, "gugugaga-idle");
  assert.equal(CHARACTERS[0].id, DEFAULT_CHARACTER_ID);
  assert.deepEqual(CHARACTERS.filter((character) => character.id.startsWith("cat-"))
    .map((character) => character.id), ["cat-idle"]);
});

test("咕咕嘎嘎作为免费内置角色进入市场", () => {
  const character = CHARACTERS.find((item) => item.id === "gugugaga-idle");
  assert.ok(character);
  assert.equal(character.name, "咕咕嘎嘎");
  assert.equal(character.category, "沙雕日常");
});

test("咕咕嘎嘎九种造型有稳定顺序，无效设置回到默认造型", () => {
  assert.equal(GUGUGAGA_STATES.length, 9);
  assert.equal(new Set(GUGUGAGA_STATES.map((state) => state.id)).size, 9);
  assert.equal(DEFAULT_GUGUGAGA_STATE_ID, "gugugaga-idle");
  assert.equal(resolveGugugagaStateId("gugugaga-cat"), "gugugaga-cat");
  assert.equal(resolveGugugagaStateId("not-a-state"), DEFAULT_GUGUGAGA_STATE_ID);
  assert.deepEqual(CHARACTERS[0].variants, GUGUGAGA_STATES.slice(1).map((state) => state.id));
});

test("已下架角色和无效选择迁移到咕咕嘎嘎，自定义角色保持不变", () => {
  assert.equal(resolveCharacterId("cat-study"), DEFAULT_CHARACTER_ID);
  assert.equal(resolveCharacterId("not-a-pet"), DEFAULT_CHARACTER_ID);
  const custom = { id: "custom-12345678-1234-1234-1234-123456789abc" };
  assert.equal(resolveCharacterId(custom.id, [custom]), custom.id);
});

test("陪伴模式兼容旧的暂停自主活动设置", () => {
  assert.deepEqual(MOVEMENT_MODES.map((mode) => mode.id), ["stay", "wander", "follow"]);
  assert.equal(resolveMovementMode("follow", true), "follow");
  assert.equal(resolveMovementMode(undefined, false), "stay");
  assert.equal(resolveMovementMode("unknown", true), "wander");
});

test("跟随鼠标每次只靠近一小步，并在光标附近停下", () => {
  const area = { x: 0, y: 0, width: 1200, height: 800 };
  const bounds = { x: 100, y: 100, width: 240, height: 280 };
  assert.deepEqual(nextFollowBounds(bounds, { x: 220, y: 240 }, area), bounds);
  const next = nextFollowBounds(bounds, { x: 900, y: 650 }, area);
  assert.ok(next.x > bounds.x && next.x - bounds.x <= 8);
  assert.ok(next.y > bounds.y && next.y - bounds.y <= 8);
});

test("every built-in character has local artwork", () => {
  for (const character of CHARACTERS) {
    const artwork = path.join(__dirname, "..", "assets", "pets", character.id + ".gif");
    const bytes = fs.readFileSync(artwork);
    assert.equal(bytes.toString("ascii", 0, 6), "GIF89a", character.name);
    let frames = 0;
    for (let index = 0; index < bytes.length - 1; index++) {
      if (bytes[index] === 0x21 && bytes[index + 1] === 0xf9) frames++;
    }
    assert.ok(frames >= 2, character.name + " 必须是真正的动图");
  }
});

test("custom imports accept supported raster signatures and reject SVG", () => {
  assert.equal(detectImageType(Buffer.from("89504e470d0a1a0a", "hex")).extension, "png");
  assert.equal(detectImageType(Buffer.from("ffd8ff", "hex")).extension, "jpg");
  assert.equal(detectImageType(Buffer.from("GIF89a", "ascii")).extension, "gif");
  assert.equal(detectImageType(Buffer.from("RIFF0000WEBP", "ascii")).extension, "webp");
  assert.equal(detectImageType(Buffer.from("<svg></svg>", "utf8")), null);
});

test("animated PNG and WebP keep their frames instead of entering static cutout", () => {
  const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");
  const pngChunk = (name) => Buffer.concat([
    Buffer.alloc(4), Buffer.from(name, "ascii"), Buffer.alloc(4),
  ]);
  const animatedPng = Buffer.concat([pngSignature, pngChunk("acTL"), pngChunk("IDAT")]);
  const staticPng = Buffer.concat([pngSignature, pngChunk("IDAT")]);
  const lateAnimationChunk = Buffer.concat([staticPng, pngChunk("acTL")]);
  assert.equal(isAnimatedImage(animatedPng, detectImageType(animatedPng)), true);
  assert.equal(isAnimatedImage(staticPng, detectImageType(staticPng)), false);
  assert.equal(isAnimatedImage(lateAnimationChunk, detectImageType(lateAnimationChunk)), false);

  const webp = Buffer.concat([
    Buffer.from("RIFF0000WEBPVP8X", "ascii"), Buffer.from([10, 0, 0, 0, 0x02]),
  ]);
  const staticWebp = Buffer.from(webp);
  staticWebp[20] = 0;
  assert.equal(isAnimatedImage(webp, detectImageType(webp)), true);
  assert.equal(isAnimatedImage(staticWebp, detectImageType(staticWebp)), false);
  assert.equal(isAnimatedImage(Buffer.from("GIF89a", "ascii"),
    detectImageType(Buffer.from("GIF89a", "ascii"))), true);
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

test("generated pet records accept only SVG created by the app", () => {
  const id = "custom-12345678-1234-1234-1234-123456789abc";
  assert.equal(isValidCustomPet({ id, name: "小伙伴", extension: "svg", kind: "generated" }), true);
  assert.equal(isValidCustomPet({ id, name: "小伙伴", extension: "svg" }), false);
});
