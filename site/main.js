const heroPet = document.querySelector("#hero-pet");
const heroSymbol = document.querySelector("#hero-symbol");
const heroCaption = document.querySelector("#hero-caption");
const petCards = document.querySelectorAll(".state-card[data-pet]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function selectPet(card) {
  petCards.forEach((item) => {
    const selected = item === card;
    item.classList.toggle("is-active", selected);
    item.setAttribute("aria-pressed", String(selected));
  });

  heroPet.src = "./media/" + card.dataset.image;
  heroPet.alt = card.querySelector("strong").textContent + "正在桌面上陪伴";
  heroSymbol.textContent = card.dataset.symbol;
  heroCaption.textContent = card.dataset.caption;
}

petCards.forEach((card) => card.addEventListener("click", () => selectPet(card)));

function updateMotionPreference() {
  document.documentElement.classList.toggle("reduce-media", reducedMotion.matches);
}

reducedMotion.addEventListener("change", updateMotionPreference);
updateMotionPreference();
