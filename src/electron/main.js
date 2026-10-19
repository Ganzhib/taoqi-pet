const { app, BrowserWindow, Menu, Notification, Tray, dialog, ipcMain, nativeImage, screen, shell } = require("electron");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const path = require("node:path");
const { TOOLBOX_URL, CHARACTERS, DECORATIONS, HOME_THEMES, HOME_FURNITURE, detectImageType, clampToWorkArea } = require("./pet-core");

const { DEFAULT_SETTINGS, FOCUS_DURATION_MS, customPetPath, readSettings, saveSettings } = require("./settings-store");
const { renderPetSvg } = require("./character-generator");
const { cutoutStaticImage } = require("./cutout");
const { resolveArtworkSource, resolveImageSource } = require("./animation/artwork-source");
const { registerPetScheme, registerPetProtocol } = require("./animation/protocol");
const { createUpdateManager } = require("./update-manager");

// 自定义协议必须在 app ready 之前注册，否则 Chromium 不会按标准协议对待它，
// <video> 也就拿不到流式数据
registerPetScheme();

const BASE_SIZE = { width: 240, height: 280 };
const ICON_PATH = path.join(__dirname, "../../assets/icon.png");

let petWindow;
let tray;
let marketWindow = null;
let homeWindow = null;
let toolboxWindow = null;
let updateManager = null;
let settings;
let dragOrigin = null;
let walkTimeout = null;
let walkInterval = null;
let focusTimer = null;
let isQuitting = false;
// 桌宠唯一的消失理由应该是「用户显式隐藏」。但 macOS 会在点击桌面、切换
// Space 等场合把窗口收起来，所以用两个标记把情况分开：
//   hiddenByUser —— 用户自己藏的，守卫不许插手
//   petReady     —— 窗口还没到首次显示，守卫别提前把它弹出来
let hiddenByUser = false;
let petReady = false;
let visibilityGuard = null;

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
  saveSettings(settings);
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

// 桌面层是 macOS 独有的概念，「点击墙纸显示桌面」也是 macOS 特有的行为。
function isDesktopLevel() {
  return settings.desktopLevel && process.platform === "darwin";
}

// 桌面层模式必须放弃置顶：置顶会把窗口抬离桌面层，
// 而「点击墙纸不被推走」的豁免正是桌面层独有的，两者不能兼得。
function petShouldFloat() {
  return settings.alwaysOnTop && !isDesktopLevel();
}

function applyPetWindowLevel() {
  if (isDesktopLevel()) {
    // 不能调用 setAlwaysOnTop：即便传 false 也会把窗口层级重置成 normal，
    // 桌面层的豁免权当场失效（实测踩过）。setVisibleOnAllWorkspaces 实测无碍，
    // 保留它可以继续跨 Space 可见。
    petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    return;
  }
  const float = petShouldFloat();
  petWindow.setAlwaysOnTop(float, float ? "screen-saver" : "normal");
  if (process.platform === "darwin") {
    // Fullscreen apps live in separate Spaces; normal always-on-top alone cannot cross them.
    petWindow.setVisibleOnAllWorkspaces(float, {
      visibleOnFullScreen: float,
    });
  }
}

function updateSettings(patch) {
  const previousDesktopLevel = settings.desktopLevel;
  settings = { ...settings, ...patch };
  saveSettings(settings);
  // 窗口的 type 只在创建时生效，切换层级模式只能重建窗口
  if (settings.desktopLevel !== previousDesktopLevel) recreatePetWindow();
  else if ("alwaysOnTop" in patch) applyPetWindowLevel();
  if ("scale" in patch) {
    petWindow.setBounds({ ...petWindow.getBounds(), ...windowSize() });
    keepPetVisible();
  }
  sendState();
  if ("roaming" in patch || "quietMode" in patch) scheduleWalk();
  updateTrayMenu();
  notifyHome();
}

function scheduleFocusEnd() {
  clearTimeout(focusTimer);
  if (!isFocusActive()) return;
  focusTimer = setTimeout(() => {
    settings.focusEndsAt = null;
    saveSettings(settings);
    sendState();
    sendNotice("专注结束，休息一下吧！");
    scheduleWalk();
    updateTrayMenu();
  }, Math.max(0, settings.focusEndsAt - Date.now()));
}

function toggleFocus() {
  settings.focusEndsAt = isFocusActive() ? null : Date.now() + FOCUS_DURATION_MS;
  saveSettings(settings);
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
        description: pet.kind === "generated" ? "你亲手设计的专属宠物。" : "你导入的专属宠物。", source: "custom",
      })),
    ],
  };
}

function getHomeState() {
  const character = [...CHARACTERS, ...settings.customPets]
    .find((pet) => pet.id === settings.characterId);
  return {
    characterId: settings.characterId,
    characterName: character.name,
    decorationId: settings.decorationId,
    themeId: settings.homeThemeId,
    furnitureId: settings.homeFurnitureId,
    bestCatch: settings.bestCatch,
  };
}

function notifyHome() {
  if (homeWindow && !homeWindow.isDestroyed()) {
    homeWindow.webContents.send("home:state", getHomeState());
  }
}

function notifyMarket() {
  if (marketWindow && !marketWindow.isDestroyed()) {
    marketWindow.webContents.send("market:catalog", getCatalog());
  }
}

function artworkContext() {
  return {
    characters: CHARACTERS,
    customPets: settings.customPets,
    customPath: customPetPath,
  };
}

function getArtworkSource(id) {
  return resolveArtworkSource(id, artworkContext());
}

// 给 <img> 用的图片素材（市场缩略图、小窝页面、桌宠降级）。
// 必须是图片而不是 WebM——<img> 解不了视频。
function getArtwork(id) {
  const source = resolveImageSource(id, artworkContext());
  return source ? source.url : null;
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
  const cut = type.extension === "gif" ? null : cutoutStaticImage(bytes);
  const pet = {
    id: "custom-" + randomUUID(),
    name: path.parse(source).name.trim().slice(0, 32) || "我的宠物",
    extension: cut ? "png" : type.extension,
  };
  fs.mkdirSync(path.dirname(customPetPath(pet)), { recursive: true });
  fs.writeFileSync(customPetPath(pet), cut ?? bytes);
  settings.customPets.push(pet);
  settings.characterId = pet.id;
  saveSettings(settings);
  sendState();
  notifyMarket();
  notifyHome();
  return { id: pet.id, cutout: Boolean(cut) };
}

function createGeneratedPet(options) {
  const name = typeof options?.name === "string" ? options.name.trim().slice(0, 32) : "";
  if (!name) throw new Error("请为宠物起个名字。");
  const artwork = renderPetSvg(options);
  const pet = { id: "custom-" + randomUUID(), name, extension: "svg", kind: "generated" };
  fs.mkdirSync(path.dirname(customPetPath(pet)), { recursive: true });
  fs.writeFileSync(customPetPath(pet), artwork);
  settings.customPets.push(pet);
  settings.characterId = pet.id;
  saveSettings(settings);
  sendState();
  notifyMarket();
  notifyHome();
  return pet.id;
}

function renameCustomPet(id, value) {
  const pet = settings.customPets.find((entry) => entry.id === id);
  if (!pet || typeof value !== "string") return false;
  const name = value.trim().slice(0, 32);
  if (!name) return false;
  pet.name = name;
  saveSettings(settings);
  notifyMarket();
  notifyHome();
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
  saveSettings(settings);
  sendState();
  notifyMarket();
  notifyHome();
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
      preload: path.join(__dirname, "preloads/market.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  marketWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  marketWindow.loadFile(path.join(__dirname, "../../dist-ui/market.html"));
  marketWindow.on("closed", () => { marketWindow = null; });
}

function openHome() {
  if (homeWindow && !homeWindow.isDestroyed()) {
    homeWindow.focus();
    return;
  }
  homeWindow = new BrowserWindow({
    width: 900,
    height: 690,
    minWidth: 720,
    minHeight: 590,
    title: "淘气小窝",
    icon: ICON_PATH,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preloads/home.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  homeWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  homeWindow.loadFile(path.join(__dirname, "../../dist-ui/home.html"));
  homeWindow.on("closed", () => { homeWindow = null; });
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
    detail: "单击、双击或长按宠物可以互动；拖动可以改变位置。右键或点击系统托盘可打开菜单。宠物市场里的角色全部免费，也可以导入自己的 PNG、JPG、GIF、WebP 图片。聚焦宠物后按 M 可打开市场，按 H 可进入小窝。安静模式会暂停游走和自动提示。工具铺只会在你点击后于应用内打开。",
    buttons: ["知道了"],
  });
}

function isToolboxPage(url) {
  const parsed = new URL(url);
  return parsed.protocol === "https:" && parsed.hostname === "next.ganzhibin.icu";
}

function openExternalLink(url) {
  const parsed = new URL(url);
  if (parsed.protocol === "https:" || parsed.protocol === "http:" || parsed.protocol === "mailto:") {
    shell.openExternal(url);
  }
}

function openToolbox() {
  if (toolboxWindow && !toolboxWindow.isDestroyed()) {
    toolboxWindow.show();
    toolboxWindow.focus();
    return;
  }
  toolboxWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 780,
    minHeight: 560,
    title: "淘气工具铺",
    icon: ICON_PATH,
    autoHideMenuBar: true,
    webPreferences: {
      partition: "persist:taoqi-toolbox",
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  toolboxWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isToolboxPage(url)) toolboxWindow.loadURL(url);
    else openExternalLink(url);
    return { action: "deny" };
  });
  toolboxWindow.webContents.on("will-navigate", (event, url) => {
    if (isToolboxPage(url)) return;
    event.preventDefault();
    openExternalLink(url);
  });
  toolboxWindow.loadURL(TOOLBOX_URL);
  toolboxWindow.on("closed", () => { toolboxWindow = null; });
}

function showPet() {
  if (!petWindow || petWindow.isDestroyed()) return;
  hiddenByUser = false;
  keepPetVisible();
  petWindow.showInactive();
  if (petShouldFloat()) petWindow.moveTop();
  scheduleWalk();
  updateTrayMenu();
}

// 隐藏。用户显式隐藏、关闭窗口都走这里，都会把 hiddenByUser 置上——
// 守卫据此判断「这次是有意为之」，不去打扰。
// 反过来，系统自己把窗口收走时不会经过这里，标记仍是 false，守卫就会拉回来。
function hidePet() {
  if (!petWindow || petWindow.isDestroyed()) return;
  hiddenByUser = true;
  petWindow.hide();
  clearTimeout(walkTimeout);
  stopWalk();
  updateTrayMenu();
}

// 守卫：桌宠不该自己消失。系统把它收起来时拉回来。
function keepPetOnScreen() {
  if (hiddenByUser || isQuitting || !petReady) return;
  if (!petWindow || petWindow.isDestroyed()) return;
  if (petWindow.isVisible()) return;
  showPet();
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
    { label: "淘气小窝…", click: openHome },
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
    { label: "窗口层级", submenu: windowLevelItems() },
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
    ...updateManager.menuItems(),
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

function windowLevelItems() {
  const items = [
    { label: "总在最前", type: "radio",
      checked: settings.alwaysOnTop && !isDesktopLevel(),
      click: () => updateSettings({ desktopLevel: false, alwaysOnTop: true }) },
    { label: "普通窗口", type: "radio",
      checked: !settings.alwaysOnTop && !isDesktopLevel(),
      click: () => updateSettings({ desktopLevel: false, alwaysOnTop: false }) },
  ];
  if (process.platform === "darwin") {
    items.push({ label: "桌面层（点桌面不会被推走）", type: "radio",
      checked: isDesktopLevel(),
      click: () => updateSettings({ desktopLevel: true }) });
  }
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
    alwaysOnTop: petShouldFloat(),
    // 桌面层窗口不会被「点击墙纸显示桌面」推走，但代价是永远在应用窗口之下
    ...(isDesktopLevel() ? { type: "desktop" } : {}),
    backgroundColor: "#00000000",
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, "preloads/pet.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const self = petWindow;
  applyPetWindowLevel();
  petWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  petWindow.loadFile(path.join(__dirname, "../../dist-ui/index.html"));
  petWindow.webContents.on("did-finish-load", sendState);
  petWindow.once("ready-to-show", () => {
    petReady = true;
    showPet();
  });
  // 系统把窗口收起来时立刻拉回来。延迟一拍是避免和系统的隐藏动作抢。
  petWindow.on("hide", () => setTimeout(keepPetOnScreen, 150));
  // 兜底：部分系统级隐藏不触发 hide 事件，定时查一次
  visibilityGuard = setInterval(keepPetOnScreen, 3000);
  petWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hidePet();
      return;
    }
    persistPosition();
  });
  petWindow.on("closed", () => {
    // 已经被新窗口取代时不要再动全局状态，否则会清掉新窗口的计时器
    if (petWindow !== self) return;
    clearTimeout(walkTimeout);
    clearInterval(visibilityGuard);
    stopWalk();
    petWindow = null;
  });
}

// 重建桌宠窗口。窗口的 type 只在创建时生效，切换层级模式只能走这条路。
// 先建新窗口再销毁旧的：中间不会出现零窗口，避免触发 window-all-closed 退出。
function recreatePetWindow() {
  const old = petWindow;
  petReady = false;
  dragOrigin = null;
  clearTimeout(walkTimeout);
  clearInterval(visibilityGuard);
  stopWalk();
  createPetWindow();
  if (old && !old.isDestroyed()) old.destroy();
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
    registerPetProtocol();
    app.setName("淘气桌宠");
    settings = readSettings();
    if (process.platform === "win32") app.setAppUserModelId("icu.ganzhibin.taoqipet");
    updateManager = createUpdateManager({
      app, Notification, dialog, shell,
      isQuiet: () => settings.quietMode,
      sendNotice,
      refreshMenu: updateTrayMenu,
      beforeInstall: () => { isQuitting = true; },
    });
    ipcMain.handle("pet:get-state", () => ({ ...settings, focusActive: isFocusActive() }));
    ipcMain.handle("pet:get-artwork", (_event, id) => getArtwork(id));
    ipcMain.handle("pet:get-artwork-source", (_event, id) => getArtworkSource(id));
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
    ipcMain.handle("market:preview-generated", (_event, options) =>
      "data:image/svg+xml;base64," + Buffer.from(renderPetSvg(options)).toString("base64"));
    ipcMain.handle("market:create-generated", (_event, options) => createGeneratedPet(options));
    ipcMain.handle("market:remove", (_event, id) => removeCustomPet(id));
    ipcMain.handle("market:rename", (_event, id, name) => renameCustomPet(id, name));
    ipcMain.handle("home:get-state", getHomeState);
    ipcMain.handle("home:set-theme", (_event, id) => {
      if (!HOME_THEMES.some((theme) => theme.id === id)) return false;
      updateSettings({ homeThemeId: id });
      return true;
    });
    ipcMain.handle("home:set-furniture", (_event, id) => {
      if (!HOME_FURNITURE.some((furniture) => furniture.id === id)) return false;
      updateSettings({ homeFurnitureId: id });
      return true;
    });
    ipcMain.handle("home:save-score", (_event, score) => {
      if (!Number.isInteger(score) || score < 0) return settings.bestCatch;
      if (score > settings.bestCatch) {
        settings.bestCatch = score;
        saveSettings(settings);
        notifyHome();
      }
      return settings.bestCatch;
    });
    ipcMain.on("pet:show-menu", showPetMenu);
    ipcMain.on("pet:open-market", openMarket);
    ipcMain.on("pet:open-home", openHome);
    ipcMain.on("pet:drag-start", beginDrag);
    ipcMain.on("pet:drag-move", moveDrag);
    ipcMain.on("pet:drag-end", endDrag);
    screen.on("display-removed", keepPetVisible);
    screen.on("display-metrics-changed", keepPetVisible);
    createPetWindow();
    createTray();
    updateManager.start();
    scheduleFocusEnd();
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    isQuitting = true;
    updateManager.stop();
    clearTimeout(walkTimeout);
    clearTimeout(focusTimer);
    stopWalk();
    persistPosition();
  });
}
