const TOOLBOX_URL = "https://next.ganzhibin.icu/?utm_source=taoqi_pet&utm_medium=app&utm_content=toolbox";

const CHARACTERS = [
  { id: "cat-idle", name: "发呆猫", category: "沙雕日常", description: "什么都没做，但已经很努力了。" },
  { id: "cat-study", name: "冲刺猫", category: "学习中", description: "笔记翻开，知识正在缓慢加载。" },
  { id: "cat-work", name: "赶工猫", category: "打工中", description: "DDL 追我，我追咖啡。" },
  { id: "cat-coffee", name: "咖啡续命猫", category: "打工中", description: "这一杯下去，灵魂短暂上线。" },
  { id: "cat-debug", name: "修 Bug 猫", category: "打工中", description: "它刚刚又把自己写的代码看哭了。" },
  { id: "cat-slack", name: "摸鱼猫", category: "沙雕日常", description: "不是在偷懒，是在给大脑散热。" },
  { id: "cat-nap", name: "装睡猫", category: "沙雕日常", description: "眼睛很清醒，嘴巴已经开始打呼。" },
  { id: "cat-cheer", name: "下班猫", category: "沙雕日常", description: "今天也是靠可爱顺利收工。" },
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

function clampToWorkArea(bounds, workArea) {
  const maxX = Math.max(workArea.x, workArea.x + workArea.width - bounds.width);
  const maxY = Math.max(workArea.y, workArea.y + workArea.height - bounds.height);
  return {
    ...bounds,
    x: Math.min(Math.max(bounds.x, workArea.x), maxX),
    y: Math.min(Math.max(bounds.y, workArea.y), maxY),
  };
}

module.exports = { TOOLBOX_URL, CHARACTERS, DECORATIONS, HOME_THEMES, HOME_FURNITURE, IMAGE_TYPES, detectImageType, isValidCustomPet, clampToWorkArea };
