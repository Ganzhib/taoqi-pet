const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, screen, shell } = require("electron");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const path = require("node:path");
const { TOOLBOX_URL, CHARACTERS, DECORATIONS, IMAGE_TYPES, detectImageType, isValidCustomPet, clampToWorkArea } = require("./pet-core");

const BASE_SIZE = { width: 240, height: 280 };
const DEFAULT_SETTINGS = {
  roaming: true,
  quietMode: false,
  alwaysOnTop: true,
  scale: 1,
  characterId: "caramel",
  decorationId: "none",
  customPets: [],
  position: null,
  focusEndsAt: null,
};
const FOCUS_DURATION_MS = 25 * 60 * 1000;
const ICON_PATH = path.join(__dirname, "../assets/icon.png");

let petWindow;
let tray;
let marketWindow = null;
let settings;
let dragOrigin = null;
let walkTimeout = null;
let walkInterval = null;
let focusTimer = null;
let isQuitting = false;

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function customPetPath(pet) {
  return path.join(app.getPath("userData"), "pets", pet.id + "." + pet.extension);
}

function readSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
    const customPets = (Array.isArray(saved.customPets) ? saved.customPets : [])
      .filter(isValidCustomPet)
      .map((pet) => ({ id: pet.id, name: pet.name.trim().slice(0, 32), extension: pet.extension }))
      .filter((pet) => fs.existsSync(customPetPath(pet)));
    const now = Date.now();
    return {
      roaming: saved.roaming !== false,
      quietMode: saved.quietMode === true,
      alwaysOnTop: saved.alwaysOnTop !== false,
      scale: [1, 1.25, 1.5].includes(saved.scale) ? saved.scale : 1,
      characterId: [...CHARACTERS, ...customPets].some((character) => character.id === saved.characterId)
        ? saved.characterId : DEFAULT_SETTINGS.characterId,
      customPets,
      decorationId: DECORATIONS.some((decoration) => decoration.id === saved.decorationId)
        ? saved.decorationId : DEFAULT_SETTINGS.decorationId,
      position: saved.position && Number.isFinite(saved.position.x) && Number.isFinite(saved.position.y)
        ? { x: Math.round(saved.position.x), y: Math.round(saved.position.y) } : null,
      focusEndsAt: Number.isFinite(saved.focusEndsAt) &&
        saved.focusEndsAt > now && saved.focusEndsAt <= now + FOCUS_DURATION_MS
        ? saved.focusEndsAt : null,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
}

function windowSize() {
  return {
    width: Math.round(BASE_SIZE.width * settings.scale),
    height: Math.round(BASE_SIZE.height * settings.scale),
  };
}

function isFocusActive() {
  return settings.focusEndsAt !== null;
}

function sendState() {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send("pet:state", { ...settings, focusActive: isFocusActive() });
  }
}

function sendNotice(message) {
  if (!settings.quietMode && petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send("pet:notice", message);
  }
}

function stopWalk() {
  clearInterval(walkInterval);
  walkInterval = null;
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send("pet:motion", "idle");
  }
}

function scheduleWalk() {
  clearTimeout(walkTimeout);
  stopWalk();
  if (!settings.roaming || settings.quietMode || isFocusActive() || dragOrigin ||
      !petWindow || petWindow.isDestroyed() || !petWindow.isVisible()) return;
  walkTimeout = setTimeout(startWalk, 14000 + Math.random() * 12000);
}

function startWalk() {
  if (!petWindow || petWindow.isDestroyed() || !petWindow.isVisible()) return;
  const direction = Math.random() < 0.5 ? -1 : 1;
  let steps = 0;
  petWindow.webContents.send("pet:motion", "walk");
  walkInterval = setInterval(() => {
    if (dragOrigin || settings.quietMode || isFocusActive() || !settings.roaming) {
      scheduleWalk();
      return;
    }
    const bounds = petWindow.getBounds();
    const area = screen.getDisplayMatching(bounds).workArea;
    const next = clampToWorkArea({ ...bounds, x: bounds.x + direction * 5 }, area);
    if (next.x === bounds.x || steps++ >= 10) {
      scheduleWalk();
      return;
    }
    petWindow.setPosition(next.x, next.y, false);
  }, 75);
}

function persistPosition() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const { x, y } = petWindow.getBounds();
  settings.position = { x, y };
  saveSettings();
}

function keepPetVisible() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const bounds = petWindow.getBounds();
  const area = screen.getDisplayMatching(bounds).workArea;
  const next = clampToWorkArea(bounds, area);
  if (next.x !== bounds.x || next.y !== bounds.y) {
    petWindow.setBounds(next);
    persistPosition();
  }
}

function updateSettings(patch) {
  settings = { ...settings, ...patch };
  saveSettings();
  if ("alwaysOnTop" in patch) petWindow.setAlwaysOnTop(settings.alwaysOnTop);
  if ("scale" in patch) {
    petWindow.setBounds({ ...petWindow.getBounds(), ...windowSize() });
    keepPetVisible();
  }
  sendState();
  if ("roaming" in patch || "quietMode" in patch) scheduleWalk();
  updateTrayMenu();
}

function scheduleFocusEnd() {
  clearTimeout(focusTimer);
  if (!isFocusActive()) return;
  focusTimer = setTimeout(() => {
    settings.focusEndsAt = null;
    saveSettings();
    sendState();
    sendNotice("专注结束，休息一下吧！");
    scheduleWalk();
    updateTrayMenu();
  }, Math.max(0, settings.focusEndsAt - Date.now()));
}

function toggleFocus() {
  settings.focusEndsAt = isFocusActive() ? null : Date.now() + FOCUS_DURATION_MS;
  saveSettings();
  scheduleFocusEnd();
  sendState();
  if (isFocusActive()) sendNotice("专注开始，我会安静陪着你。");
  scheduleWalk();
  updateTrayMenu();
}

function getCatalog() {
  return {
    selectedId: settings.characterId,
    pets: [
      ...CHARACTERS.map((pet) => ({ ...pet, source: "built-in" })),
      ...settings.customPets.map((pet) => ({
        id: pet.id, name: pet.name, category: "我的创作",
        description: "你导入的专属宠物。", source: "custom",
      })),
    ],
  };
}

function notifyMarket() {
  if (marketWindow && !marketWindow.isDestroyed()) {
    marketWindow.webContents.send("market:catalog", getCatalog());
  }
}

function getArtwork(id) {
  const builtIn = CHARACTERS.find((pet) => pet.id === id);
  const custom = settings.customPets.find((pet) => pet.id === id);
  if (!builtIn && !custom) return null;
  const file = builtIn
    ? path.join(__dirname, "../assets/pets", builtIn.id + ".svg")
    : customPetPath(custom);
  const mime = builtIn ? "image/svg+xml"
    : IMAGE_TYPES.find((type) => type.extension === custom.extension).mime;
  try {
    return "data:" + mime + ";base64," + fs.readFileSync(file).toString("base64");
  } catch {
    return null;
  }
}

function selectCharacter(id) {
  if (![...CHARACTERS, ...settings.customPets].some((pet) => pet.id === id)) return false;
  updateSettings({ characterId: id });
  notifyMarket();
  return true;
}

async function importCustomPet() {
  const result = await dialog.showOpenDialog(marketWindow, {
    title: "导入我的宠物",
    filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
    properties: ["openFile"],
  });
  if (result.canceled) return null;
  const source = result.filePaths[0];
  if (fs.statSync(source).size > 5 * 1024 * 1024) {
    throw new Error("图片不能超过 5 MB。");
  }
  const bytes = fs.readFileSync(source);
  const type = detectImageType(bytes);
  if (!type) throw new Error("请选择 PNG、JPG、GIF 或 WebP 图片。");
  const pet = {
    id: "custom-" + randomUUID(),
    name: path.parse(source).name.trim().slice(0, 32) || "我的宠物",
    extension: type.extension,
  };
  fs.mkdirSync(path.dirname(customPetPath(pet)), { recursive: true });
  fs.writeFileSync(customPetPath(pet), bytes);
  settings.customPets.push(pet);
  settings.characterId = pet.id;
  saveSettings();
  sendState();
  notifyMarket();
  return pet.id;
}

function renameCustomPet(id, value) {
  const pet = settings.customPets.find((entry) => entry.id === id);
  if (!pet || typeof value !== "string") return false;
  const name = value.trim().slice(0, 32);
  if (!name) return false;
  pet.name = name;
  saveSettings();
  notifyMarket();
  return true;
}

async function removeCustomPet(id) {
  const pet = settings.customPets.find((entry) => entry.id === id);
  if (!pet) return false;
  const { response } = await dialog.showMessageBox(marketWindow, {
    type: "question",
    title: "删除自定义宠物",
    message: "删除“" + pet.name + "”？",
    detail: "这会删除保存在淘气桌宠中的图片，原始文件不会受影响。",
    buttons: ["取消", "删除"],
    defaultId: 0,
    cancelId: 0,
  });
  if (response !== 1) return false;
  fs.rmSync(customPetPath(pet), { force: true });
  settings.customPets = settings.customPets.filter((entry) => entry.id !== id);
  if (settings.characterId === id) settings.characterId = DEFAULT_SETTINGS.characterId;
  saveSettings();
  sendState();
  notifyMarket();
  return true;
}

function openMarket() {
  if (marketWindow && !marketWindow.isDestroyed()) {
    marketWindow.focus();
    return;
  }
  marketWindow = new BrowserWindow({
    width: 840,
    height: 640,
    minWidth: 680,
    minHeight: 500,
    title: "淘气宠物市场",
    icon: ICON_PATH,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "market-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  marketWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  marketWindow.loadFile(path.join(__dirname, "market.html"));
  marketWindow.on("closed", () => { marketWindow = null; });
}

function performActivity(action) {
  showPet();
  petWindow.webContents.send("pet:action", action);
}

function showHelp() {
  showPet();
  dialog.showMessageBox(petWindow, {
    type: "info",
    title: "淘气桌宠使用帮助",
    message: "陪伴，随时由你决定",
    detail: "单击、双击或长按宠物可以互动；拖动可以改变位置。右键或点击系统托盘可打开菜单。宠物市场里的角色全部免费，也可以导入自己的 PNG、JPG、GIF、WebP 图片。安静模式会暂停游走和自动提示。工具铺只会在你点击后打开。",
    buttons: ["知道了"],
  });
}

async function openToolbox() {
  try {
    await shell.openExternal(TOOLBOX_URL);
  } catch {
    dialog.showErrorBox("无法打开工具铺", "请稍后再试，或在浏览器中访问 next.ganzhibin.icu。");
  }
}

function showPet() {
  if (!petWindow || petWindow.isDestroyed()) return;
  keepPetVisible();
  petWindow.showInactive();
  scheduleWalk();
  updateTrayMenu();
}

function hidePet() {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.hide();
  clearTimeout(walkTimeout);
  stopWalk();
  updateTrayMenu();
}

function togglePetVisibility() {
  if (petWindow.isVisible()) hidePet();
  else showPet();
}

function resetPosition() {
  const area = screen.getPrimaryDisplay().workArea;
  const size = windowSize();
  petWindow.setBounds(clampToWorkArea({
    ...size,
    x: area.x + area.width - size.width - 48,
    y: area.y + area.height - size.height - 48,
  }, area));
  persistPosition();
  showPet();
}

function menuTemplate() {
  const focusMinutes = isFocusActive()
    ? Math.max(0, Math.ceil((settings.focusEndsAt - Date.now()) / 60000)) : 0;
  const items = [
    { label: petWindow.isVisible() ? "隐藏宠物" : "显示宠物", click: togglePetVisibility },
    { label: "宠物市场…", click: openMarket },
    { label: "快速切换角色", submenu: CHARACTERS.map((character) => ({
      label: character.name,
      type: "radio",
      checked: settings.characterId === character.id,
      click: () => selectCharacter(character.id),
    })) },
    { label: "装扮", submenu: DECORATIONS.map((decoration) => ({
      label: decoration.name,
      type: "radio",
      checked: settings.decorationId === decoration.id,
      click: () => updateSettings({ decorationId: decoration.id }),
    })) },
    { label: "和它互动", submenu: [
      { label: "喂小鱼", click: () => performActivity("feed") },
      { label: "陪它玩", click: () => performActivity("play") },
      { label: "夸夸它", click: () => performActivity("praise") },
    ] },
    { label: "安静模式", type: "checkbox", checked: settings.quietMode,
      click: (item) => updateSettings({ quietMode: item.checked }) },
    { label: "暂停自主活动", type: "checkbox", checked: !settings.roaming,
      click: (item) => updateSettings({ roaming: !item.checked }) },
    { label: isFocusActive() ? "结束专注（剩余 " + focusMinutes + " 分钟）" : "开始 25 分钟专注",
      click: toggleFocus },
    { label: "总在最前", type: "checkbox", checked: settings.alwaysOnTop,
      click: (item) => updateSettings({ alwaysOnTop: item.checked }) },
    { label: "大小", submenu: [1, 1.25, 1.5].map((scale) => ({
      label: Math.round(scale * 100) + "%",
      type: "radio",
      checked: settings.scale === scale,
      click: () => updateSettings({ scale }),
    })) },
  ];
  if (app.isPackaged && (process.platform === "darwin" || process.platform === "win32")) {
    items.push({ label: "开机启动", type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) });
  }
  items.push(
    { type: "separator" },
    { label: "我的工具", submenu: [
      { label: "打开淘气工具铺（简历、画图等）", click: openToolbox },
    ] },
    { type: "separator" },
    { label: "回到屏幕右下角", click: resetPosition },
    { label: "使用帮助", click: showHelp },
    { label: "退出", click: () => app.quit() },
  );
  return items;
}

function updateTrayMenu() {
  if (tray) tray.setContextMenu(Menu.buildFromTemplate(menuTemplate()));
}

function showPetMenu() {
  Menu.buildFromTemplate(menuTemplate()).popup({ window: petWindow });
}

function beginDrag() {
  clearTimeout(walkTimeout);
  stopWalk();
  dragOrigin = {
    cursor: screen.getCursorScreenPoint(),
    bounds: petWindow.getBounds(),
  };
}

function moveDrag() {
  if (!dragOrigin) return;
  const cursor = screen.getCursorScreenPoint();
  const target = {
    ...dragOrigin.bounds,
    x: dragOrigin.bounds.x + cursor.x - dragOrigin.cursor.x,
    y: dragOrigin.bounds.y + cursor.y - dragOrigin.cursor.y,
  };
  const area = screen.getDisplayNearestPoint(cursor).workArea;
  const next = clampToWorkArea(target, area);
  petWindow.setPosition(next.x, next.y, false);
}

function endDrag() {
  if (!dragOrigin) return;
  dragOrigin = null;
  persistPosition();
  scheduleWalk();
}

function initialBounds() {
  const size = windowSize();
  if (settings.position) {
    const area = screen.getDisplayNearestPoint(settings.position).workArea;
    return clampToWorkArea({ ...size, ...settings.position }, area);
  }
  const area = screen.getPrimaryDisplay().workArea;
  return clampToWorkArea({
    ...size,
    x: area.x + area.width - size.width - 48,
    y: area.y + area.height - size.height - 48,
  }, area);
}

function createPetWindow() {
  petWindow = new BrowserWindow({
    ...initialBounds(),
    frame: false,
    transparent: true,
    resizable: false,
    show: false,
    alwaysOnTop: settings.alwaysOnTop,
    backgroundColor: "#00000000",
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  petWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  petWindow.loadFile(path.join(__dirname, "index.html"));
  petWindow.webContents.on("did-finish-load", sendState);
  petWindow.once("ready-to-show", showPet);
  petWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hidePet();
      return;
    }
    persistPosition();
  });
  petWindow.on("closed", () => {
    clearTimeout(walkTimeout);
    stopWalk();
    petWindow = null;
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(ICON_PATH).resize({ width: 20, height: 20 });
  tray = new Tray(icon);
  tray.setToolTip("淘气桌宠");
  tray.on("click", showPet);
  updateTrayMenu();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showPet);
  app.on("activate", showPet);
  app.whenReady().then(() => {
    app.setName("淘气桌宠");
    settings = readSettings();
    ipcMain.handle("pet:get-state", () => ({ ...settings, focusActive: isFocusActive() }));
    ipcMain.handle("pet:get-artwork", (_event, id) => getArtwork(id));
    ipcMain.handle("market:get-catalog", getCatalog);
    ipcMain.handle("market:select", (_event, id) => selectCharacter(id));
    ipcMain.handle("market:artwork", (_event, id) => getArtwork(id));
    ipcMain.handle("market:import", async () => {
      try {
        return await importCustomPet();
      } catch (error) {
        dialog.showErrorBox("导入失败", error.message);
        return null;
      }
    });
    ipcMain.handle("market:remove", (_event, id) => removeCustomPet(id));
    ipcMain.handle("market:rename", (_event, id, name) => renameCustomPet(id, name));
    ipcMain.on("pet:show-menu", showPetMenu);
    ipcMain.on("pet:drag-start", beginDrag);
    ipcMain.on("pet:drag-move", moveDrag);
    ipcMain.on("pet:drag-end", endDrag);
    screen.on("display-removed", keepPetVisible);
    screen.on("display-metrics-changed", keepPetVisible);
    createPetWindow();
    createTray();
    scheduleFocusEnd();
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    isQuitting = true;
    clearTimeout(walkTimeout);
    clearTimeout(focusTimer);
    stopWalk();
    persistPosition();
  });
}
