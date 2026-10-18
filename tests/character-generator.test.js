const test = require("node:test");
const assert = require("node:assert/strict");
const { renderPetSvg } = require("../src/electron/character-generator");

test("generated artwork is self-contained and changes with chosen options", () => {
  const cat = renderPetSvg({ shape: "cat", color: "#f5c46b", eyes: "round" });
  const dragon = renderPetSvg({ shape: "dragon", color: "#afd9c9", eyes: "sparkle" });
  assert.match(cat, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(cat, /#f5c46b/);
  assert.notEqual(cat, dragon);
});

test("generator rejects untrusted SVG attributes", () => {
  assert.throws(() => renderPetSvg({
    shape: "cat", color: '#fff" onload="alert(1)', eyes: "round",
  }));
  assert.throws(() => renderPetSvg({
    shape: "<script>", color: "#f5c46b", eyes: "round",
  }));
});
