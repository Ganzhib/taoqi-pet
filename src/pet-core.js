const TOOLBOX_URL = "https://next.ganzhibin.icu/?utm_source=taoqi_pet&utm_medium=app&utm_content=toolbox";

const CHARACTERS = [
  { id: "caramel", name: "焦糖猫", category: "日常陪伴", description: "活力满满的老朋友。" },
  { id: "night", name: "星夜猫", category: "日常陪伴", description: "安静陪你熬过灵感时刻。" },
  { id: "mint", name: "薄荷猫", category: "日常陪伴", description: "清清爽爽，随时出发。" },
  { id: "cloud-dragon", name: "云朵龙", category: "动漫感", description: "爱打喷嚏的小龙，喷出的是云朵。" },
  { id: "radio-fox", name: "电波狐", category: "动漫感", description: "耳机里永远有下一首歌。" },
  { id: "cloud-ghost", name: "迷糊幽灵", category: "动漫感", description: "飘来飘去，也会认真陪伴。" },
  { id: "office-blob", name: "打工团子", category: "搞笑梗", description: "端着咖啡，努力假装很精神。" },
  { id: "fish-shark", name: "摸鱼鲨", category: "搞笑梗", description: "看起来很凶，其实只想休息。" },
];

const DECORATIONS = [
  { id: "none", name: "不戴饰品" },
  { id: "star", name: "星星发夹" },
  { id: "bow", name: "蝴蝶结" },
  { id: "flower", name: "小花" },
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
    IMAGE_TYPES.some((type) => type.extension === pet.extension);
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

module.exports = { TOOLBOX_URL, CHARACTERS, DECORATIONS, IMAGE_TYPES, detectImageType, isValidCustomPet, clampToWorkArea };
