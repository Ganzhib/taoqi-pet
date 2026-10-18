const { app, BrowserWindow, Menu, dialog, ipcMain, screen, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { TOOLBOX_URL, CHARACTERS, clampToWorkArea } = require("./pet-core");

const BASE_SIZE = { width: 240, height: 280 };
const DEFAULT_SETTINGS = { roaming: true, alwaysOnTop: true, scale: 1, characterId: "caramel" };
const FOCUS_DURATION_MS = 25 * 60 * 1000;

let petWindow;
let settings;
let dragOrigin = null;
let walkTimeout = null;
let walkInterval = null;
let focusTimer = null;
let focusActive = false;

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function readSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
    return {
      roaming: saved.roaming !== false,
      alwaysOnTop: saved.alwaysOnTop !== false,
      scale: [1, 1.25, 1.5].includes(saved.scale) ? saved.scale : 1,
      characterId: CHARACTERS.some((character) => character.id === saved.characterId)
        ? saved.characterId : DEFAULT_SETTINGS.characterId,
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

function sendState() {
  petWindow.webContents.send("pet:state", { ...settings, focusActive });
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
  if (!settings.roaming || focusActive || dragOrigin || !petWindow || petWindow.isDestroyed()) return;
  walkTimeout = setTimeout(startWalk, 14000 + Math.random() * 12000);
}

function startWalk() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const direction = Math.random() < 0.5 ? -1 : 1;
  let steps = 0;
  petWindow.webContents.send("pet:motion", "walk");
  walkInterval = setInterval(() => {
    if (dragOrigin || focusActive || !settings.roaming) {
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

function keepPetVisible() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const bounds = petWindow.getBounds();
  const area = screen.getDisplayMatching(bounds).workArea;
  const next = clampToWorkArea(bounds, area);
  petWindow.setBounds(next);
}

function updateSettings(patch) {
  settings = { ...settings, ...patch };
  saveSettings();
  petWindow.setAlwaysOnTop(settings.alwaysOnTop);
  if (patch.scale) {
    const bounds = petWindow.getBounds();
    petWindow.setBounds({ ...bounds, ...windowSize() });
    keepPetVisible();
  }
  sendState();
  scheduleWalk();
}

function toggleFocus() {
  if (focusActive) {
    clearTimeout(focusTimer);
    focusTimer = null;
    focusActive = false;
  } else {
    focusActive = true;
    focusTimer = setTimeout(() => {
      focusTimer = null;
      focusActive = false;
      sendState();
      petWindow.webContents.send("pet:notice", "专注结束，休息一下吧！");
      scheduleWalk();
    }, FOCUS_DURATION_MS);
    petWindow.webContents.send("pet:notice", "专注开始，我会安静陪着你。");
  }
  sendState();
  scheduleWalk();
}

async function openToolbox() {
  try {
    await shell.openExternal(TOOLBOX_URL);
  } catch {
    dialog.showErrorBox("无法打开工具铺", "请稍后再试，或在浏览器中访问 next.ganzhibin.icu。");
  }
}

function showPetMenu() {
  const menu = Menu.buildFromTemplate([
    { label: "角色", submenu: CHARACTERS.map((character) => ({
      label: character.name,
      type: "radio",
      checked: settings.characterId === character.id,
      click: () => updateSettings({ characterId: character.id }),
    })) },
    { label: "暂停自主活动", type: "checkbox", checked: !settings.roaming,
      click: (item) => updateSettings({ roaming: !item.checked }) },
    { label: focusActive ? "结束专注" : "开始 25 分钟专注", click: toggleFocus },
    { label: "总在最前", type: "checkbox", checked: settings.alwaysOnTop,
      click: (item) => updateSettings({ alwaysOnTop: item.checked }) },
    { label: "大小", submenu: [1, 1.25, 1.5].map((scale) => ({
      label: Math.round(scale * 100) + "%",
      type: "radio",
      checked: settings.scale === scale,
      click: () => updateSettings({ scale }),
    })) },
    { type: "separator" },
    { label: "我的工具", submenu: [
      { label: "打开淘气工具铺（简历、画图等）", click: openToolbox },
    ] },
    { type: "separator" },
    { label: "回到屏幕右下角", click: resetPosition },
    { label: "退出", click: () => app.quit() },
  ]);
  menu.popup({ window: petWindow });
}

function resetPosition() {
  const area = screen.getPrimaryDisplay().workArea;
  const size = windowSize();
  petWindow.setBounds(clampToWorkArea({
    ...size,
    x: area.x + area.width - size.width - 48,
    y: area.y + area.height - size.height - 48,
  }, area));
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
  dragOrigin = null;
  scheduleWalk();
}

function createPetWindow() {
  const size = windowSize();
  const area = screen.getPrimaryDisplay().workArea;
  petWindow = new BrowserWindow({
    ...size,
    x: area.x + area.width - size.width - 48,
    y: area.y + area.height - size.height - 48,
    frame: false,
    transparent: true,
    resizable: false,
    show: false,
    alwaysOnTop: settings.alwaysOnTop,
    backgroundColor: "#00000000",
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
  petWindow.once("ready-to-show", () => {
    petWindow.showInactive();
    scheduleWalk();
  });
  petWindow.on("closed", () => {
    clearTimeout(walkTimeout);
    stopWalk();
    petWindow = null;
  });
}

app.whenReady().then(() => {
  app.setName("淘气桌宠");
  settings = readSettings();
  ipcMain.handle("pet:get-state", () => ({ ...settings, focusActive }));
  ipcMain.on("pet:show-menu", showPetMenu);
  ipcMain.on("pet:drag-start", beginDrag);
  ipcMain.on("pet:drag-move", moveDrag);
  ipcMain.on("pet:drag-end", endDrag);
  screen.on("display-removed", keepPetVisible);
  screen.on("display-metrics-changed", keepPetVisible);
  createPetWindow();
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  clearTimeout(walkTimeout);
  clearTimeout(focusTimer);
  stopWalk();
});
