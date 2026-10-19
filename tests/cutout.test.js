const test = require("node:test");
const assert = require("node:assert/strict");
const { removeBackground } = require("../src/electron/cutout");

function raster(width, height, paint) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = paint(x, y);
      const index = (y * width + x) * 4;
      rgba[index] = r;
      rgba[index + 1] = g;
      rgba[index + 2] = b;
      rgba[index + 3] = a;
    }
  }
  return rgba;
}

const alphaAt = (rgba, width, x, y) => rgba[(y * width + x) * 4 + 3];

test("removes a solid backdrop and keeps the subject", () => {
  const width = 60;
  const height = 60;
  const rgba = raster(width, height, (x, y) =>
    x > 15 && x < 45 && y > 15 && y < 45 ? [220, 90, 90, 255] : [250, 250, 250, 255]);
  const cleared = removeBackground(rgba, width, height);
  assert.ok(cleared);
  assert.equal(alphaAt(cleared, width, 5, 5), 0);
  assert.equal(alphaAt(cleared, width, 30, 30), 255);
});

test("keeps an inner pocket that never touches the border", () => {
  const width = 60;
  const height = 60;
  const rgba = raster(width, height, (x, y) => {
    if (x > 24 && x < 36 && y > 24 && y < 36) return [250, 250, 250, 255];
    return [220, 90, 90, 255];
  });
  const cleared = removeBackground(rgba, width, height);
  assert.ok(cleared);
  assert.equal(alphaAt(cleared, width, 30, 30), 255);
});

test("reports no background for a uniform picture", () => {
  const cleared = removeBackground(raster(40, 40, () => [10, 120, 200, 255]), 40, 40);
  assert.equal(cleared, null);
});

test("treats transparent borders as background", () => {
  const width = 50;
  const height = 50;
  const rgba = raster(width, height, (x, y) =>
    x > 10 && x < 40 && y > 10 && y < 40 ? [80, 160, 90, 255] : [0, 0, 0, 0]);
  const cleared = removeBackground(rgba, width, height);
  assert.ok(cleared);
  assert.equal(alphaAt(cleared, width, 25, 25), 255);
  assert.equal(alphaAt(cleared, width, 5, 5), 0);
});

test("refuses to erase almost the whole picture", () => {
  const width = 100;
  const height = 100;
  const rgba = raster(width, height, (x, y) =>
    x > 48 && x < 52 && y > 48 && y < 52 ? [200, 60, 60, 255] : [255, 255, 255, 255]);
  assert.equal(removeBackground(rgba, width, height), null);
});
