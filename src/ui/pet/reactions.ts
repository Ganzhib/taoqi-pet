import type { PetReaction } from "../shared/contracts";

const reactions = {
  "cat-idle": {
    tap: ["在呢，在呢。", "脑袋空空，快乐满满。", "今天也先喘口气。"],
    double: "吓得我差点开始工作！",
    long: "摸够了吗？再摸五分钟。",
    feed: "小鱼到位，精神加倍。",
    play: "来一场毫无目的的追逐！",
    praise: "夸得我想原地打滚。",
  },
  "cat-study": {
    tap: ["这题我会……才怪。", "再学五分钟就会了吧？", "知识正在加载中。"],
    double: "哎呀，灵感闪了一下！",
    long: "别卷了，先摸摸我。",
    feed: "补脑小鱼安排上！",
    play: "课间休息，开始！",
    praise: "我感觉自己能考满分！",
  },
  "cat-work": {
    tap: ["这个需求它正经吗？", "DDL 又在身后追我。", "先保存，再崩溃。"],
    double: "键盘都要冒烟了！",
    long: "让我假装正在开会。",
    feed: "终于到饭点了吗？",
    play: "摸鱼五秒，不许举报。",
    praise: "本月优秀打工猫是我！",
  },
  "cat-coffee": {
    tap: ["咖啡因正在接管身体。", "眼睛上班了，灵魂还没。"],
    double: "不许再给我续杯啦！",
    long: "我闻到休息的味道。",
    feed: "小鱼比咖啡靠谱。",
    play: "现在速度是两倍！",
    praise: "清醒得像一只猫。",
  },
  "cat-debug": {
    tap: ["Bug 在哪？刚刚还在。", "这段代码谁写的……哦是我。"],
    double: "修好了！等等，又坏了。",
    long: "让我和错误日志对视一会儿。",
    feed: "吃饱了才好找 Bug。",
    play: "先把异常抛给未来的我。",
    praise: "我竟然找到根因了！",
  },
  "cat-slack": {
    tap: ["我在思考鱼生。", "这不叫摸鱼，叫静态分析。"],
    double: "嘘，老板来了！",
    long: "趁现在再眯一会儿。",
    feed: "摸到真的鱼了！",
    play: "摸鱼也要认真玩。",
    praise: "年度摸鱼冠军，实至名归。",
  },
  "cat-nap": {
    tap: ["我没睡，我在闭眼思考。", "呼噜……什么事？"],
    double: "被你叫醒啦！",
    long: "一起午睡吧。",
    feed: "梦里也有小鱼。",
    play: "睡醒再玩，好不好？",
    praise: "我连睡觉都这么优秀。",
  },
  "cat-cheer": {
    tap: ["下班啦，猫先走！", "今天也活着交付了。"],
    double: "撒花！再来一次！",
    long: "庆祝活动延长五分钟。",
    feed: "庆功宴有小鱼吗？",
    play: "快来跳下班舞！",
    praise: "谢谢！我也觉得很棒！",
  },
};

export function reactionMessage(characterId: string, kind: PetReaction, tapIndex: number): string {
  const character = reactions[characterId as keyof typeof reactions] ?? reactions["cat-idle"];
  if (kind === "tap") return character.tap[tapIndex % character.tap.length];
  if (kind === "nap") return "呼……让我打个小盹。";
  return character[kind];
}
