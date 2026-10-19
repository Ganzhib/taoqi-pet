"use strict";

const fs = require("node:fs");
const path = require("node:path");

// 桌宠素材的统一入口。
//
// 渲染层只认 kind（"gif" / "video" / "image"），不认文件后缀。这样 M2 把
// 内置素材从 GIF 换成透明 WebM 时，改的只有下面 BUILT_IN_FORMATS 的顺序，
// 渲染侧代码一行都不用动。

// 内置角色素材的候选格式，按优先级排列。
// M2 生成 <id>.webm 入库后自动命中 webm 分支；缺失时自动回退 gif。
const BUILT_IN_FORMATS = [
  { extension: "webm", mime: "video/webm", kind: "video" },
  { extension: "gif", mime: "image/gif", kind: "gif" },
];

// 内置素材走自定义协议，不用 data URL。
//
// 原因：Chromium 拒绝从 data: URL 加载媒体资源，<video src="data:video/webm;base64,...">
// 会直接报 "Media load rejected by URL safety check"（networkState=3，无可用源）。
// 图片没这个限制，但视频必须走真实协议。
const PET_SCHEME = "pet";

function petUrl(id, extension) {
  return PET_SCHEME + "://pets/" + id + "." + extension;
}

// 自定义宠物的 mime 表，口径与 pet-core 的 IMAGE_TYPES 保持一致。
const CUSTOM_MIMES = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

// 素材管线约定：内置动画统一 280×320、12 帧、95 ms/帧，由
// scripts/render-cat-gifs.py 与 scripts/render-friend-gifs.py 保证。
// M3 起改为从容器读取真实帧数/帧间隔。
const PIPELINE = { width: 280, height: 320, frameCount: 12, frameDelayMs: 95 };

// 自定义宠物的 data URL 缓存。
//
// 内置素材走 pet:// 协议，不需要编码；自定义宠物仍然是 data URL（单张几百 KB
// 转 base64 后还要再大三分之一）。市场刷一次就是十几次读盘加编码，白白产生
// 几 MB 短命字符串。这里按「绝对路径 + mtime + size」缓存并在素材被替换时
// 自动失效，同时限制条目数上限，避免自定义宠物越攒越多。
const MAX_CACHE_ENTRIES = 64;
const encodedCache = new Map();

function statOrNull(file) {
  try {
    return fs.statSync(file);
  } catch {
    return null;
  }
}

function encodeFile(file, mime) {
  const stat = statOrNull(file);
  if (stat === null) return null;
  const cached = encodedCache.get(file);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.url;
  let url;
  try {
    url = "data:" + mime + ";base64," + fs.readFileSync(file).toString("base64");
  } catch {
    return null;
  }
  if (!encodedCache.has(file) && encodedCache.size >= MAX_CACHE_ENTRIES) {
    encodedCache.delete(encodedCache.keys().next().value);
  }
  encodedCache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, url });
  return url;
}

function petsRoot() {
  // 本文件位于 src/electron/animation/，退三层才是仓库根
  return path.join(__dirname, "../../../assets/pets");
}

function resolveBuiltInSource(character, skipVideo = false) {
  for (const format of BUILT_IN_FORMATS) {
    if (skipVideo && format.kind === "video") continue;
    const file = path.join(petsRoot(), character.id + "." + format.extension);
    if (!fs.existsSync(file)) continue;
    return {
      id: character.id,
      kind: format.kind,
      mime: format.mime,
      url: petUrl(character.id, format.extension),
      frameCount: PIPELINE.frameCount,
      frameDelayMs: PIPELINE.frameDelayMs,
    };
  }
  return null;
}

function resolveCustomSource(pet, customPath) {
  if (typeof customPath !== "function") return null;
  const mime = CUSTOM_MIMES[pet.extension];
  if (!mime) return null;
  // 捏宠产物才允许是 SVG，杜绝外部 SVG 被当作宠物加载
  if (pet.extension === "svg" && pet.kind !== "generated") return null;
  const url = encodeFile(customPath(pet), mime);
  if (url === null) return null;
  return {
    id: pet.id,
    kind: pet.extension === "gif" ? "gif" : "image",
    mime,
    url,
    frameCount: null,
    frameDelayMs: null,
  };
}

// 返回素材描述，找不到对应角色时返回 null。
//
// options: { characters, customPets, customPath }
function resolveArtworkSource(id, options = {}) {
  if (typeof id !== "string" || id.length === 0) return null;
  const characters = Array.isArray(options.characters) ? options.characters : [];
  const customPets = Array.isArray(options.customPets) ? options.customPets : [];
  const character = characters.find((pet) => pet.id === id);
  if (character) return resolveBuiltInSource(character);
  const custom = customPets.find((pet) => pet.id === id);
  if (custom) return resolveCustomSource(custom, options.customPath);
  return null;
}

// 图片源：显式排掉 video 分支，只给 <img> 能解码的素材。
//
// 两处都要用：
//   1. 市场缩略图、小窝页面——它们就是 <img>，拿到 webm 只会 naturalWidth 恒为 0
//   2. 桌宠视频解码失败时的降级
//
// 关键是别复用 resolveArtworkSource：它同样优先 webm，拿回来的还是同一个
// 视频地址，等于没降级。
function resolveImageSource(id, options = {}) {
  if (typeof id !== "string" || id.length === 0) return null;
  const characters = Array.isArray(options.characters) ? options.characters : [];
  const character = characters.find((pet) => pet.id === id);
  if (character) return resolveBuiltInSource(character, true);
  // 自定义宠物本来就是静态图/动图，不存在视频分支，原样返回
  return resolveArtworkSource(id, options);
}

// 缓存条目数，供测试与诊断使用
function cachedEntryCount() {
  return encodedCache.size;
}

module.exports = {
  PIPELINE,
  PET_SCHEME,
  petsRoot,
  petUrl,
  resolveArtworkSource,
  resolveImageSource,
  cachedEntryCount,
};
