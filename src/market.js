const grid = document.getElementById("pet-grid");
const status = document.getElementById("status");
const importButton = document.getElementById("import-pet");
const filters = [...document.querySelectorAll(".filters button")];

let catalog = { selectedId: null, pets: [] };
let category = "全部";
let renderVersion = 0;
let refreshVersion = 0;

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function loadArtwork(image, id, version) {
  const artwork = await window.petMarket.getArtwork(id);
  if (version === renderVersion && image.isConnected && artwork) image.src = artwork;
}

function createCard(pet, version) {
  const active = pet.id === catalog.selectedId;
  const card = element("article", "pet-card" + (active ? " active" : ""));
  const preview = element("div", "pet-preview");
  const image = document.createElement("img");
  image.alt = pet.name + "的插画";
  preview.append(image);
  loadArtwork(image, pet.id, version);

  const meta = element("div", "card-meta");
  meta.append(element("h2", "", pet.name), element("span", "category", pet.category));
  const description = element("p", "description", pet.description);

  const actions = element("div", "card-actions");
  const select = element("button", "card-action" + (active ? " selected" : ""),
    active ? "正在陪伴" : "选它陪伴");
  select.type = "button";
  select.disabled = active;
  select.addEventListener("click", async () => {
    select.disabled = true;
    try {
      await window.petMarket.select(pet.id);
      await refresh();
    } catch (error) {
      status.textContent = error.message;
      select.disabled = false;
    }
  });
  actions.append(select);

  if (pet.source === "custom") {
    const remove = element("button", "remove-button", "删除");
    remove.type = "button";
    remove.setAttribute("aria-label", "删除" + pet.name);
    remove.addEventListener("click", async () => {
      try {
        if (await window.petMarket.removePet(pet.id)) await refresh();
      } catch (error) {
        status.textContent = error.message;
      }
    });
    actions.append(remove);
  }

  card.append(preview, meta, description, actions);
  return card;
}

function render() {
  const version = ++renderVersion;
  const visible = catalog.pets.filter((pet) => category === "全部" || pet.category === category);
  grid.replaceChildren(...visible.map((pet) => createCard(pet, version)));
  if (visible.length === 0) {
    grid.append(element("p", "empty", "这里还没有宠物。点击右上角，导入你自己的图片吧。"));
  }
  const selected = catalog.pets.find((pet) => pet.id === catalog.selectedId);
  status.textContent = selected
    ? "共 " + catalog.pets.length + " 位小伙伴 · 当前陪伴：" + selected.name
    : "正在加载宠物…";
  for (const button of filters) {
    button.setAttribute("aria-pressed", String(button.dataset.category === category));
  }
}

async function refresh() {
  const version = ++refreshVersion;
  const next = await window.petMarket.getCatalog();
  if (version === refreshVersion) {
    catalog = next;
    render();
  }
}

for (const button of filters) {
  button.addEventListener("click", () => {
    category = button.dataset.category;
    render();
  });
}

importButton.addEventListener("click", async () => {
  importButton.disabled = true;
  try {
    if (await window.petMarket.importPet()) {
      category = "我的创作";
      await refresh();
    }
  } catch (error) {
    status.textContent = error.message;
  } finally {
    importButton.disabled = false;
  }
});

window.petMarket.onCatalog((next) => {
  refreshVersion++;
  catalog = next;
  render();
});
refresh().catch((error) => { status.textContent = error.message; });
