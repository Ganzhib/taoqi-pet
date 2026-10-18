const pet = document.getElementById("pet");
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
  const character = reactions[characterId];
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

function applyState(state) {
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
