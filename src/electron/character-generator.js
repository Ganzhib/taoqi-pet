const SHAPES = ["cat", "dragon", "bean"];
const EYES = ["round", "sleepy", "sparkle"];

function renderPetSvg({ shape, color, eyes }) {
  if (!SHAPES.includes(shape) || !EYES.includes(eyes) ||
      typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) {
    throw new Error("请选择有效的造型、颜色和表情。");
  }

  const ears = {
    cat: '<path d="M46 76 47 31 82 61M154 76l-1-45-35 30" fill="' + color + '" stroke="#49375d" stroke-width="7" stroke-linejoin="round"/>',
    dragon: '<path d="M54 75 43 40 73 60M146 75l11-35-30 20" fill="#f8dc8f" stroke="#49375d" stroke-width="7" stroke-linejoin="round"/>',
    bean: "",
  }[shape];
  const face = {
    round: '<circle cx="76" cy="107" r="6" fill="#49375d"/><circle cx="124" cy="107" r="6" fill="#49375d"/>',
    sleepy: '<path d="M68 108q8 8 16 0m32 0q8 8 16 0" fill="none" stroke="#49375d" stroke-width="5" stroke-linecap="round"/>',
    sparkle: '<path d="m76 97 3 8 8 3-8 3-3 8-3-8-8-3 8-3Zm48 0 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#49375d"/>',
  }[eyes];
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220">' +
    '<ellipse cx="100" cy="200" rx="57" ry="8" fill="#49375d" opacity=".12"/>' +
    ears +
    '<path d="M100 57c-42 0-65 29-65 76 0 40 24 69 65 69s65-29 65-69c0-47-23-76-65-76Z" fill="' +
    color + '" stroke="#49375d" stroke-width="7"/>' +
    '<ellipse cx="100" cy="159" rx="28" ry="21" fill="#fff8eb" opacity=".58"/>' +
    face +
    '<path d="M94 130q6 7 12 0" fill="none" stroke="#49375d" stroke-width="4" stroke-linecap="round"/>' +
    '<circle cx="60" cy="129" r="9" fill="#f5a5ad" opacity=".75"/>' +
    '<circle cx="140" cy="129" r="9" fill="#f5a5ad" opacity=".75"/>' +
    '</svg>';
}

module.exports = { SHAPES, EYES, renderPetSvg };
