const assert = require("node:assert/strict");
const fs = require("node:fs");

const macIcon = fs.readFileSync("build/icon.icns");
assert.equal(macIcon.toString("ascii", 0, 4), "icns", "macOS 图标不是 ICNS 文件");
assert.equal(macIcon.readUInt32BE(4), macIcon.length, "macOS 图标已截断");

let offset = 8;
const iconTypes = new Set();
while (offset < macIcon.length) {
  const type = macIcon.toString("ascii", offset, offset + 4);
  const length = macIcon.readUInt32BE(offset + 4);
  assert.ok(length >= 8 && offset + length <= macIcon.length, "macOS 图标包含不完整的图像块");
  iconTypes.add(type);
  offset += length;
}
assert.ok(iconTypes.has("ic12"), "macOS 图标缺少 1024 像素图像");

const windowsIcon = fs.readFileSync("build/icon.ico");
assert.equal(windowsIcon.readUInt16LE(0), 0, "Windows 图标头无效");
assert.equal(windowsIcon.readUInt16LE(2), 1, "Windows 图标不是 ICO 文件");
const imageCount = windowsIcon.readUInt16LE(4);
const sizes = new Set();
for (let index = 0; index < imageCount; index += 1) {
  const entry = 6 + index * 16;
  const width = windowsIcon[entry] || 256;
  const length = windowsIcon.readUInt32LE(entry + 8);
  const imageOffset = windowsIcon.readUInt32LE(entry + 12);
  assert.ok(imageOffset + length <= windowsIcon.length, "Windows 图标包含不完整的图像");
  sizes.add(width);
}
assert.ok(sizes.has(256), "Windows 图标缺少 256 像素图像");
console.log("Windows 和 macOS 应用图标检查通过");
