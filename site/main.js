const heroPet = document.querySelector("#hero-pet");
const heroSymbol = document.querySelector("#hero-symbol");
const heroCaption = document.querySelector("#hero-caption");
const petCards = document.querySelectorAll(".state-card[data-pet]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const releaseVersion = document.querySelector("#release-version");
const releasePage = document.querySelector("#release-page");
const releaseAssets = document.querySelectorAll("[data-release-asset]");

async function updateLatestRelease() {
  try {
    const response = await fetch("https://api.github.com/repos/Ganzhib/taoqi-pet/releases/latest", {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return;
    const release = await response.json();
    if (!/^v\d+\.\d+\.\d+$/.test(release.tag_name) || !Array.isArray(release.assets)) return;

    const version = release.tag_name.slice(1);
    const expectedNames = {
      "windows-installer": `taoqi-pet-setup-${version}-win-x64.exe`,
      "windows-portable": `taoqi-pet-portable-${version}-win-x64.exe`,
      "mac-arm64": `taoqi-pet-${version}-mac-arm64.dmg`,
      "mac-x64": `taoqi-pet-${version}-mac-x64.dmg`,
    };
    const assetsByName = new Map(release.assets.map((asset) => [asset.name, asset.browser_download_url]));
    const resolved = Object.entries(expectedNames).map(([key, name]) => [key, assetsByName.get(name)]);
    if (resolved.some(([, url]) => typeof url !== "string")) return;

    releaseAssets.forEach((link) => {
      const match = resolved.find(([key]) => key === link.dataset.releaseAsset);
      if (match) link.href = match[1];
    });
    releaseVersion.textContent = release.tag_name;
    releasePage.href = release.html_url;
    releasePage.textContent = release.tag_name + " 官方 GitHub Release";
  } catch {
    // 保留 HTML 中经过发布验收的稳定版本链接。
  }
}

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
updateLatestRelease();
