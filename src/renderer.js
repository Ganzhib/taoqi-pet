const pet = document.getElementById("pet");
const bubble = document.getElementById("bubble");
const hint = document.querySelector(".hint");
const reactions = {
  caramel: {
    tap: ["你好呀！", "今天也一起加油！", "我在这里陪你。"],
    double: "跳两下给你看！",
    long: "呼噜呼噜～",
  },
  night: {
    tap: ["星星还亮着呢。", "慢一点也没关系。", "陪你安静待一会儿。"],
    double: "被你发现啦！",
    long: "让我再眯一小会儿。",
  },
  mint: {
    tap: ["出发吧！", "来点新灵感！", "今天会很顺利的。"],
    double: "耶！再玩一次！",
    long: "抱抱充电中～",
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
  reactionTimer = setTimeout(() => delete pet.dataset.reaction, 650);
  showBubble(message);
}

function applyState(state) {
  characterId = state.characterId;
  pet.dataset.character = characterId;
  pet.classList.toggle("focused", state.focusActive);
  pet.style.scale = state.scale;
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
});

window.taoqiPet.onMotion((motion) => {
  pet.classList.toggle("walking", motion === "walk");
});
window.taoqiPet.onNotice(showBubble);
window.taoqiPet.onState(applyState);
window.taoqiPet.getState().then(applyState);

setTimeout(() => hint.classList.add("hidden"), 5000);
