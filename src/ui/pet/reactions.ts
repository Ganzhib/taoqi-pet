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
  "penguin-idle": {
    tap: ["滑一下就到了。", "摇摇晃晃，但没摔倒。", "肚子是白的，不信你看。"],
    double: "脚下一滑，假装没事！",
    long: "让我在你屏幕上滑一会儿。",
    feed: "鱼要冰的，谢谢。",
    play: "来，一起滑冰！",
    praise: "被夸了，翅膀都扑棱起来。",
  },
  "kitty-idle": {
    tap: ["奶凶奶凶的。", "撒娇才是本体。", "踩奶预备中。"],
    double: "被吓成一只小毛球！",
    long: "呼噜呼噜……续费成功。",
    feed: "喝奶……好吧，吃鱼。",
    play: "追着自己的尾巴跑！",
    praise: "被夸了，毛都亮了。",
  },
  "doggy-idle": {
    tap: ["尾巴摇成雨刷！", "今天也是敬业小狗。", "摸狗头，工资加薪。"],
    double: "汪汪！有用不完的劲！",
    long: "别停，我还能嗨。",
    feed: "骨头……小鱼也行！",
    play: "出去玩！现在！立刻！",
    praise: "被夸得想原地转圈。",
  },
  "dragon-idle": {
    tap: ["泡泡发射中。", "别戳，会漏气。", "翅膀借你拍拍。"],
    double: "喷出一个大泡泡！",
    long: "让泡泡载着你飘一会儿。",
    feed: "吃完有力气吹泡泡。",
    play: "来比谁吹的泡泡大！",
    praise: "泡泡变得更圆了。",
  },
  "bunny-idle": {
    tap: ["耳朵先动了！", "萝卜……我是说小鱼呢？", "蹦一下算打招呼。"],
    double: "吓出萝卜跳！",
    long: "耳朵给你随便摸。",
    feed: "吃得腮帮鼓鼓。",
    play: "蹦迪模式，启动！",
    praise: "耳朵害羞地垂下来了。",
  },
  "blob-idle": {
    tap: ["软软的，随便捏。", "团子没有烦恼。", "被戳会晃三下。"],
    double: "晃得太用力，差点变形。",
    long: "给你当靠垫，随便靠。",
    feed: "吃一口，胖一圈。",
    play: "弹来弹去最好玩。",
    praise: "开心得冒泡。",
  },
};

export function reactionMessage(characterId: string, kind: PetReaction, tapIndex: number): string {
  const character = reactions[characterId as keyof typeof reactions] ?? reactions["cat-idle"];
  if (kind === "tap") return character.tap[tapIndex % character.tap.length];
  if (kind === "nap") return "呼……让我打个小盹。";
  if (kind === "look") return "左看看，右看看。";
  if (kind === "waddle") return "企鹅步，出发！";
  if (kind === "slide") return "贴地滑行！";
  return character[kind];
}
