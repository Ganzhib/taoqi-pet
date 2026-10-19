const TOOLBOX_URL = "https://next.ganzhibin.icu/?utm_source=taoqi_pet&utm_medium=app&utm_content=toolbox";
const DEFAULT_CHARACTER_ID = "gugugaga-idle";

const CHARACTERS = [
  {
    id: "gugugaga-idle",
    name: "咕咕嘎嘎",
    category: "沙雕日常",
    description: "书包一背，随时切换九种表情和穿搭。",
    variants: [
      "gugugaga-beanie",
      "gugugaga-pajamas",
      "gugugaga-overalls",
      "gugugaga-happy",
      "gugugaga-worker",
      "gugugaga-prayer",
      "gugugaga-daydream",
      "gugugaga-cat",
    ],
  },
  { id: "penguin-idle", name: "企鹅", category: "沙雕日常", description: "自带羽绒服，还是觉得冷。" },
  { id: "cat-idle", name: "发呆猫", category: "沙雕日常", description: "什么都没做，但已经很努力了。" },
  { id: "kitty-idle", name: "小奶猫", category: "沙雕日常", description: "奶凶奶凶的，随时准备躺平。" },
  { id: "doggy-idle", name: "打工狗", category: "打工中", description: "尾巴摇成螺旋桨，活儿照样干完。" },
  { id: "dragon-idle", name: "泡泡龙", category: "沙雕日常", description: "喷的不是火，是可爱的泡泡。" },
  { id: "bunny-idle", name: "蹦蹦兔", category: "沙雕日常", description: "耳朵先答话，腿脚跟不上。" },
  { id: "blob-idle", name: "云朵团子", category: "沙雕日常", description: "软到没有骨头，只剩好脾气。" },
];

const MOVEMENT_MODES = [
  { id: "stay", name: "原地陪伴" },
  { id: "wander", name: "自由散步" },
  { id: "follow", name: "跟随鼠标" },
];

const DECORATIONS = [
  { id: "none", name: "不戴饰品" },
  { id: "star", name: "星星发夹" },
  { id: "bow", name: "蝴蝶结" },
  { id: "flower", name: "小花" },
];

const HOME_THEMES = [
  { id: "sunny", name: "晴日小窝" },
  { id: "night", name: "星夜小窝" },
  { id: "candy", name: "糖果小窝" },
];

const HOME_FURNITURE = [
  { id: "cushion", name: "软软坐垫" },
  { id: "box", name: "秘密纸箱" },
  { id: "cloud", name: "云朵沙发" },
  { id: "rug", name: "星星地毯" },
  { id: "basket", name: "编织小篮" },
];

const IMAGE_TYPES = [
  { extension: "png", mime: "image/png", matches: (bytes) =>
    bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) },
  { extension: "jpg", mime: "image/jpeg", matches: (bytes) =>
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { extension: "gif", mime: "image/gif", matches: (bytes) =>
    ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6)) },
  { extension: "webp", mime: "image/webp", matches: (bytes) =>
    bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" },
];

function detectImageType(bytes) {
  return IMAGE_TYPES.find((type) => type.matches(bytes)) || null;
}

function isValidCustomPet(pet) {
  return pet && /^custom-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(pet.id) &&
    typeof pet.name === "string" && pet.name.trim().length > 0 &&
    (IMAGE_TYPES.some((type) => type.extension === pet.extension) ||
      (pet.kind === "generated" && pet.extension === "svg"));
}

function resolveCharacterId(characterId, customPets = []) {
  return [...CHARACTERS, ...customPets].some((character) => character.id === characterId)
    ? characterId : DEFAULT_CHARACTER_ID;
}

function resolveMovementMode(movementMode, roaming) {
  if (MOVEMENT_MODES.some((mode) => mode.id === movementMode)) return movementMode;
  return roaming === false ? "stay" : "wander";
}

function clampToWorkArea(bounds, workArea) {
  const maxX = Math.max(workArea.x, workArea.x + workArea.width - bounds.width);
  const maxY = Math.max(workArea.y, workArea.y + workArea.height - bounds.height);
  return {
    ...bounds,
    x: Math.min(Math.max(bounds.x, workArea.x), maxX),
    y: Math.min(Math.max(bounds.y, workArea.y), maxY),
  };
}

function nextFollowBounds(bounds, cursor, workArea, maxStep = 8, stopDistance = 90) {
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const deltaX = cursor.x - centerX;
  const deltaY = cursor.y - centerY;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= stopDistance) return bounds;
  const step = Math.min(maxStep, distance - stopDistance);
  return clampToWorkArea({
    ...bounds,
    x: Math.round(bounds.x + deltaX / distance * step),
    y: Math.round(bounds.y + deltaY / distance * step),
  }, workArea);
}

module.exports = {
  TOOLBOX_URL,
  DEFAULT_CHARACTER_ID,
  CHARACTERS,
  MOVEMENT_MODES,
  DECORATIONS,
  HOME_THEMES,
  HOME_FURNITURE,
  IMAGE_TYPES,
  detectImageType,
  isValidCustomPet,
  resolveCharacterId,
  resolveMovementMode,
  clampToWorkArea,
  nextFollowBounds,
};
