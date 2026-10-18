const pet = document.getElementById("pet");
const bubble = document.getElementById("bubble");
const hint = document.querySelector(".hint");
const reactions = ["你好呀！", "今天也一起加油！", "摸摸头～", "我在这里陪你。"];
let reactionIndex = 0;
let bubbleTimer = null;
let pointerStart = null;
let moved = false;

function showBubble(message) {
  bubble.textContent = message;
  bubble.classList.add("visible");
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.remove("visible"), 2600);
}

function react() {
  pet.classList.remove("happy");
  void pet.offsetWidth;
  pet.classList.add("happy");
  showBubble(reactions[reactionIndex++ % reactions.length]);
}

pet.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  pointerStart = { x: event.screenX, y: event.screenY };
  moved = false;
  pet.setPointerCapture(event.pointerId);
  window.taoqiPet.dragStart();
});

pet.addEventListener("pointermove", (event) => {
  if (!pointerStart) return;
  if (Math.abs(event.screenX - pointerStart.x) > 4 || Math.abs(event.screenY - pointerStart.y) > 4) {
    moved = true;
  }
  if (moved) window.taoqiPet.dragMove();
});

function finishPointer(event) {
  if (!pointerStart) return;
  pet.releasePointerCapture(event.pointerId);
  window.taoqiPet.dragEnd();
  if (!moved && event.type === "pointerup") react();
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
    react();
  }
});

window.taoqiPet.onMotion((motion) => {
  pet.classList.toggle("walking", motion === "walk");
});
window.taoqiPet.onNotice(showBubble);
window.taoqiPet.onState((state) => {
  pet.classList.toggle("focused", state.focusActive);
  pet.style.scale = state.scale;
});

window.taoqiPet.getState().then((state) => {
  pet.classList.toggle("focused", state.focusActive);
  pet.style.scale = state.scale;
});

setTimeout(() => hint.classList.add("hidden"), 5000);
