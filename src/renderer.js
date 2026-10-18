const pet = document.getElementById("pet");
const petArt = document.getElementById("pet-art");
const bubble = document.getElementById("bubble");
const hint = document.querySelector(".hint");
const focusBadge = document.getElementById("focus-badge");
const reactions = {
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
let characterId = "caramel";
let reactionIndex = 0;
let bubbleTimer = null;
let reactionTimer = null;
let pressTimer = null;
let pointerStart = null;
let moved = false;
let longPressed = false;
let lastTapAt = 0;
let artworkVersion = 0;
let quietMode = false;
let focusEndsAt = null;
let focusTick = null;

function showBubble(message) {
  bubble.textContent = message;
  bubble.classList.add("visible");
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.remove("visible"), 2600);
}

function react(kind) {
  const character = reactions[characterId] || reactions.caramel;
  let message = character[kind];
  if (kind === "tap") {
    message = character.tap[reactionIndex++ % character.tap.length];
  }
  delete pet.dataset.reaction;
  void pet.offsetWidth;
  pet.dataset.reaction = kind;
  clearTimeout(reactionTimer);
  const duration = kind === "double" || kind === "play" ? 1250 : 650;
  reactionTimer = setTimeout(() => delete pet.dataset.reaction, duration);
  showBubble(message);
}

function updateFocusBadge() {
  if (focusEndsAt === null) {
    focusBadge.hidden = true;
    return;
  }
  const seconds = Math.max(0, Math.ceil((focusEndsAt - Date.now()) / 1000));
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const rest = String(seconds % 60).padStart(2, "0");
  focusBadge.textContent = "专注 " + minutes + ":" + rest;
  focusBadge.hidden = false;
}

async function updateArtwork(id) {
  const version = ++artworkVersion;
  let artwork = await window.taoqiPet.getArtwork(id);
  if (!artwork) artwork = await window.taoqiPet.getArtwork("caramel");
  if (version === artworkVersion) petArt.src = artwork;
}

function applyState(state) {
  if (characterId !== state.characterId || !petArt.src) updateArtwork(state.characterId);
  characterId = state.characterId;
  quietMode = state.quietMode;
  focusEndsAt = state.focusEndsAt;
  pet.dataset.character = characterId;
  pet.dataset.decoration = state.decorationId;
  pet.classList.toggle("focused", state.focusActive);
  pet.classList.toggle("quiet", quietMode);
  pet.style.scale = state.scale;
  clearInterval(focusTick);
  updateFocusBadge();
  if (focusEndsAt !== null) focusTick = setInterval(updateFocusBadge, 1000);
}

pet.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  pointerStart = { x: event.screenX, y: event.screenY };
  moved = false;
  longPressed = false;
  pet.setPointerCapture(event.pointerId);
  window.taoqiPet.dragStart();
  pressTimer = setTimeout(() => {
    longPressed = true;
    react("long");
  }, 600);
});

pet.addEventListener("pointermove", (event) => {
  if (!pointerStart) return;
  if (Math.abs(event.screenX - pointerStart.x) > 4 || Math.abs(event.screenY - pointerStart.y) > 4) {
    moved = true;
    clearTimeout(pressTimer);
  }
  if (moved) window.taoqiPet.dragMove();
});

function finishPointer(event) {
  if (!pointerStart) return;
  clearTimeout(pressTimer);
  pet.releasePointerCapture(event.pointerId);
  window.taoqiPet.dragEnd();
  if (!moved && !longPressed && event.type === "pointerup") {
    const now = Date.now();
    react(now - lastTapAt < 350 ? "double" : "tap");
    lastTapAt = now;
  }
  pointerStart = null;
}

pet.addEventListener("pointerup", finishPointer);
pet.addEventListener("pointercancel", finishPointer);
pet.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  window.taoqiPet.showMenu();
});
pet.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    react("tap");
  }
  if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
    event.preventDefault();
    window.taoqiPet.showMenu();
  }
});

window.taoqiPet.onMotion((motion) => {
  pet.classList.toggle("walking", motion === "walk");
});
window.taoqiPet.onAction(react);
window.taoqiPet.onNotice((message) => {
  if (!quietMode) showBubble(message);
});
window.taoqiPet.onState(applyState);
window.taoqiPet.getState().then(applyState);

setTimeout(() => hint.classList.add("hidden"), 5000);
