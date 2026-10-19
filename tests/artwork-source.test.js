const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  PIPELINE,
  resolveArtworkSource,
  resolveFallbackSource,
  cachedEntryCount,
} = require("../src/electron/animation/artwork-source");
const { CHARACTERS } = require("../src/electron/pet-core");

const PNG_BYTES = Buffer.from("89504e470d0a1a0a", "hex");

function contextWith(customPets, files) {
  return {
    characters: CHARACTERS,
    customPets,
    customPath: (pet) => files[pet.id],
  };
}

test("内置角色优先解析为透明 WebM 素材", () => {
  for (const character of CHARACTERS) {
    const source = resolveArtworkSource(character.id, contextWith([], {}));
    assert.ok(source, character.name + " 缺少素材");
    assert.equal(source.kind, "video", character.name);
    assert.equal(source.mime, "video/webm", character.name);
    assert.equal(source.id, character.id);
    assert.equal(source.url, "pet://pets/" + character.id + ".webm", character.name + " 素材地址不对");
  }
});

test("内置素材必须走 pet:// 协议，不能是 data URL", () => {
  const source = resolveArtworkSource("cat-idle", contextWith([], {}));
  assert.ok(!source.url.startsWith("data:"),
    "视频用 data URL 会被 Chromium 的 URL 安全检查拒绝，必须是真实协议");
  assert.ok(source.url.startsWith("pet://"));
});

test("内置角色带管线约定的帧参数", () => {
  const source = resolveArtworkSource("cat-idle", contextWith([], {}));
  assert.equal(source.frameCount, PIPELINE.frameCount);
  assert.equal(source.frameDelayMs, PIPELINE.frameDelayMs);
});

test("未注册角色返回 null", () => {
  assert.equal(resolveArtworkSource("not-a-pet", contextWith([], {})), null);
});

test("非法入参返回 null 而不是抛错", () => {
  const context = contextWith([], {});
  assert.equal(resolveArtworkSource("", context), null);
  assert.equal(resolveArtworkSource(null, context), null);
  assert.equal(resolveArtworkSource(undefined, context), null);
  assert.equal(resolveArtworkSource(42, context), null);
  assert.equal(resolveArtworkSource("../etc/passwd", context), null);
});

test("自定义宠物按扩展名映射 mime 与 kind", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "taoqi-artwork-")), "pet.png");
  fs.writeFileSync(file, PNG_BYTES);
  const custom = { id: "custom-12345678-1234-1234-1234-123456789abc", name: "我的宠物", extension: "png" };
  const source = resolveArtworkSource(custom.id, contextWith([custom], { [custom.id]: file }));
  assert.ok(source);
  assert.equal(source.mime, "image/png");
  assert.equal(source.kind, "image");
  assert.equal(source.frameCount, null);
  assert.equal(source.frameDelayMs, null);
});

test("自定义 gif 走 gif 分支", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taoqi-artwork-"));
  const file = path.join(dir, "pet.gif");
  fs.writeFileSync(file, Buffer.from("GIF89a", "ascii"));
  const custom = { id: "custom-12345678-1234-1234-1234-123456789abc", name: "动图", extension: "gif" };
  const source = resolveArtworkSource(custom.id, contextWith([custom], { [custom.id]: file }));
  assert.equal(source.kind, "gif");
  assert.equal(source.mime, "image/gif");
});

test("svg 素材只在捏宠产物（kind=generated）时才被接受", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taoqi-artwork-"));
  const file = path.join(dir, "pet.svg");
  fs.writeFileSync(file, "<svg></svg>");
  const id = "custom-12345678-1234-1234-1234-123456789abc";
  assert.equal(resolveArtworkSource(id, contextWith([{ id, name: "外部", extension: "svg" }], { [id]: file })), null);
  assert.ok(resolveArtworkSource(id, contextWith([{ id, name: "捏的", extension: "svg", kind: "generated" }], { [id]: file })));
});

test("素材文件缺失时返回 null", () => {
  const custom = { id: "custom-12345678-1234-1234-1234-123456789abc", name: "没了", extension: "png" };
  assert.equal(
    resolveArtworkSource(custom.id, contextWith([custom], { [custom.id]: "/definitely/not/here.png" })),
    null,
  );
});

test("重复解析自定义宠物复用编码缓存，不再重复读盘", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taoqi-artwork-"));
  const file = path.join(dir, "pet.png");
  fs.writeFileSync(file, PNG_BYTES);
  const custom = { id: "custom-12345678-1234-1234-1234-123456789abc", name: "我的宠物", extension: "png" };
  const context = contextWith([custom], { [custom.id]: file });
  const original = fs.readFileSync;
  let reads = 0;
  fs.readFileSync = (...args) => { reads += 1; return original(...args); };
  try {
    const first = resolveArtworkSource(custom.id, context);
    const afterFirst = reads;
    const cached = cachedEntryCount();
    const second = resolveArtworkSource(custom.id, context);
    assert.equal(reads, afterFirst, "命中缓存时不应再次读盘");
    assert.equal(cachedEntryCount(), cached, "命中缓存不应新增条目");
    assert.equal(first.url, second.url);
  } finally {
    fs.readFileSync = original;
  }
});

test("降级源必须真的降级到 GIF，不能还是同一个视频地址", () => {
  const context = contextWith([], {});
  const source = resolveArtworkSource("cat-idle", context);
  const fallback = resolveFallbackSource("cat-idle", context);
  assert.ok(source, "主源缺失");
  assert.ok(fallback, "降级源缺失");
  assert.equal(fallback.kind, "gif", "降级源应当是 GIF");
  assert.equal(fallback.mime, "image/gif");
  assert.equal(fallback.url, "pet://pets/cat-idle.gif");
  if (source.kind === "video") {
    assert.notEqual(fallback.url, source.url, "降级源不能还是视频地址，交给 <img> 解不出来");
  }
});

test("降级源对未知 id 同样返回 null", () => {
  assert.equal(resolveFallbackSource("不存在", contextWith([], {})), null);
});
