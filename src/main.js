const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, screen, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { TOOLBOX_URL, CHARACTERS, clampToWorkArea } = require("./pet-core");

const BASE_SIZE = { width: 240, height: 280 };
const DEFAULT_SETTINGS = {
  roaming: true,
  quietMode: false,
  alwaysOnTop: true,
  scale: 1,
  characterId: "caramel",
  position: null,
  focusEndsAt: null,
};
const FOCUS_DURATION_MS = 25 * 60 * 1000;
const ICON_PATH = path.join(__dirname, "../assets/icon.png");

let petWindow;
let tray;
let settings;
let dragOrigin = null;
let walkTimeout = null;
let walkInterval = null;
let focusTimer = null;

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function readSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
    const now = Date.now();
    return {
      roaming: saved.roaming !== false,
      quietMode: saved.quietMode === true,
      alwaysOnTop: saved.alwaysOnTop !== false,
      scale: [1, 1.25, 1.5].includes(saved.scale) ? saved.scale : 1,
      characterId: CHARACTERS.some((character) => character.id === saved.characterId)
        ? saved.characterId : DEFAULT_SETTINGS.characterId,
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
    { label: "角色", submenu: CHARACTERS.map((character) => ({
      label: character.name,
      type: "radio",
      checked: settings.characterId === character.id,
      click: () => updateSettings({ characterId: character.id }),
    })) },
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
  petWindow.on("close", persistPosition);
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
    clearTimeout(walkTimeout);
    clearTimeout(focusTimer);
    stopWalk();
    persistPosition();
  });
}
