const test = require("node:test");
const assert = require("node:assert/strict");
const { TOOLBOX_URL, clampToWorkArea } = require("../src/pet-core");

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
