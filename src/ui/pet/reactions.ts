import type { PetReaction } from "../shared/contracts";

export const reactions = {
  caramel: {
    tap: ["你好呀！", "今天也一起加油！", "我在这里陪你。"],
    double: "跳两下给你看！",
    long: "呼噜呼噜～",
    feed: "小鱼真香，谢谢你！",
    play: "再追一次毛线球！",
    praise: "我会继续陪着你！",
  },
  night: {
    tap: ["星星还亮着呢。", "慢一点也没关系。", "陪你安静待一会儿。"],
    double: "被你发现啦！",
    long: "让我再眯一小会儿。",
    feed: "这条鱼像星星一样好吃。",
    play: "夜里也能一起玩。",
    praise: "偷偷开心一下。",
  },
  mint: {
    tap: ["出发吧！", "来点新灵感！", "今天会很顺利的。"],
    double: "耶！再玩一次！",
    long: "抱抱充电中～",
    feed: "能量补满啦！",
    play: "毛线球，冲呀！",
    praise: "今天更有精神了！",
  },
  "cloud-dragon": {
    tap: ["今天的云软乎乎。", "一起出发吧！"],
    double: "云朵喷嚏！",
    long: "我再盘一会儿。",
    feed: "小鱼也很好吃！",
    play: "追着云跑！",
    praise: "龙角都开心得发亮了！",
  },
  "radio-fox": {
    tap: ["下一首歌给你。", "耳朵收到好心情！"],
    double: "节拍加速！",
    long: "先听完这一段。",
    feed: "谢谢投喂！",
    play: "跟着节奏跳！",
    praise: "这句夸奖我要单曲循环。",
  },
  "cloud-ghost": {
    tap: ["我飘过来啦。", "别担心，我在呢。"],
    double: "抓不到我吧！",
    long: "慢慢飘一会儿。",
    feed: "云朵点心真好吃。",
    play: "飘高一点！",
    praise: "开心得透明了一点点。",
  },
  "office-blob": {
    tap: ["咖啡续上啦。", "摸一会儿鱼也可以。"],
    double: "下班铃响了吗？",
    long: "让我放空三秒。",
    feed: "午饭时间到！",
    play: "工位旁的小舞会！",
    praise: "今天的 KPI 是开心。",
  },
  "fish-shark": {
    tap: ["今天先摸会儿鱼。", "别怕，我不咬人。"],
    double: "摸鱼被发现啦！",
    long: "休息一下下。",
    feed: "小鱼？那是我的朋友！",
    play: "一起游两圈！",
    praise: "我也有点可爱吧？",
  },
};

export function reactionMessage(characterId: string, kind: PetReaction, tapIndex: number): string {
  const character = reactions[characterId as keyof typeof reactions] ?? reactions.caramel;
  if (kind === "tap") return character.tap[tapIndex % character.tap.length];
  if (kind === "nap") return "呼……让我打个小盹。";
  return character[kind];
}
