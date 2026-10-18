const stateCopy = {
  idle: "今天的任务：先可爱一下。",
  study: "知识加载中……请勿断电。",
  work: "DDL 跑得比我还快！",
  coffee: "咖啡因已接管这只猫。",
  debug: "这个 Bug 怎么又是我写的？",
  slack: "不是摸鱼，是静态分析。",
  nap: "我没睡，只是闭眼思考。",
  cheer: "下班快乐，喵！",
};

const heroCat = document.querySelector("#hero-cat");
const heroCaption = document.querySelector("#hero-caption");
const stateCards = document.querySelectorAll(".state-card");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function selectState(card) {
  const state = card.dataset.state;
  stateCards.forEach((item) => {
    const selected = item === card;
    item.classList.toggle("is-active", selected);
    item.setAttribute("aria-pressed", String(selected));
  });
  heroCat.src = reducedMotion.matches ? "./media/icon.png" : "./media/cat-" + state + ".gif";
  heroCat.alt = card.querySelector("strong").textContent + (reducedMotion.matches ? "图标" : "正在循环动起来");
  heroCaption.textContent = stateCopy[state];
}

stateCards.forEach((card) => card.addEventListener("click", () => selectState(card)));

function updateMotionPreference() {
  const active = document.querySelector(".state-card.is-active");
  selectState(active);
  document.querySelector(".closing img").src = reducedMotion.matches ? "./media/icon.png" : "./media/cat-cheer.gif";
  stateCards.forEach((card) => {
    const image = card.querySelector("img");
    image.src = reducedMotion.matches ? "./media/icon.png" : "./media/cat-" + card.dataset.state + ".gif";
  });
}
reducedMotion.addEventListener("change", updateMotionPreference);
updateMotionPreference();
