const { autoUpdater } = require("electron-updater");
const { newestRelease } = require("./version-check");

const RELEASES_API = "https://api.github.com/repos/Ganzhib/taoqi-pet/releases?per_page=20";
const RELEASES_PAGE = "https://github.com/Ganzhib/taoqi-pet/releases";
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function createUpdateManager({ app, Notification, dialog, shell, isQuiet, sendNotice, refreshMenu, beforeInstall }) {
  const canInstall = app.isPackaged && process.platform === "win32" &&
    !process.env.PORTABLE_EXECUTABLE_FILE;
  let status = { phase: "idle" };
  let manualCheck = false;
  let firstCheckTimer = null;
  let repeatCheckTimer = null;
  let activeNotification = null;

  function setStatus(next) {
    status = next;
    refreshMenu();
  }

  function announce(title, body, onClick) {
    if (isQuiet()) return;
    sendNotice(body);
    if (!Notification.isSupported()) return;
    activeNotification = new Notification({ title, body });
    if (onClick) activeNotification.on("click", onClick);
    activeNotification.show();
  }

  async function showUpdateError(error) {
    console.error("Update check failed:", error);
    setStatus({ phase: "error" });
    if (manualCheck) {
      manualCheck = false;
      await dialog.showMessageBox({
        type: "warning",
        title: "检查更新失败",
        message: "暂时无法获取新版本，请稍后重试。",
        buttons: ["知道了"],
      });
    }
  }

  function promptInstall() {
    if (status.phase !== "ready") return;
    dialog.showMessageBox({
      type: "question",
      title: "更新已准备好",
      message: "淘气桌宠 " + status.version + " 已下载完成。",
      detail: "现在重启即可原地安装；选择稍后，退出应用时也会安装。",
      buttons: ["稍后", "现在重启安装"],
      defaultId: 1,
      cancelId: 0,
    }).then(({ response }) => {
      if (response === 1) {
        beforeInstall();
        autoUpdater.quitAndInstall(false, true);
      }
    });
  }

  function openRelease() {
    shell.openExternal(status.url || RELEASES_PAGE);
  }

  if (canInstall) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = true;
    autoUpdater.allowDowngrade = false;
    autoUpdater.channel = "preview";

    autoUpdater.on("update-available", (info) => {
      const wasManual = manualCheck;
      manualCheck = false;
      setStatus({ phase: "downloading", version: info.version, progress: 0 });
      announce("淘气桌宠有新版本", "正在后台下载 " + info.version + "，完成后会通知你。");
      if (wasManual) {
        dialog.showMessageBox({
          type: "info",
          title: "发现新版本",
          message: "正在后台下载淘气桌宠 " + info.version + "。",
          buttons: ["知道了"],
        });
      }
    });
    autoUpdater.on("download-progress", ({ percent }) => {
      const progress = Math.floor(percent / 10) * 10;
      if (progress !== status.progress) {
        setStatus({ ...status, phase: "downloading", progress });
      }
    });
    autoUpdater.on("update-downloaded", (info) => {
      setStatus({ phase: "ready", version: info.version });
      announce("淘气桌宠更新已就绪", "新版本已下载，点击通知或菜单即可重启安装。", promptInstall);
    });
    autoUpdater.on("update-not-available", () => {
      const wasManual = manualCheck;
      manualCheck = false;
      setStatus({ phase: "idle" });
      if (wasManual) dialog.showMessageBox({
        type: "info",
        title: "已是最新版本",
        message: "当前已是最新的淘气桌宠预览版。",
        buttons: ["知道了"],
      });
    });
    autoUpdater.on("error", showUpdateError);
  }

  async function check(manual = false) {
    if (!app.isPackaged) {
      if (manual) await dialog.showMessageBox({
        type: "info", title: "检查更新", message: "请在安装版中检查更新。", buttons: ["知道了"],
      });
      return;
    }
    if (status.phase === "ready") {
      if (manual) promptInstall();
      return;
    }
    if (status.phase === "checking" || status.phase === "downloading") {
      if (manual) await dialog.showMessageBox({
        type: "info",
        title: "检查更新",
        message: status.phase === "checking" ? "正在检查更新。" : "正在下载更新。",
        buttons: ["知道了"],
      });
      return;
    }

    const previouslyAvailable = status.phase === "available" ? status.version : null;
    manualCheck = manual;
    setStatus({ phase: "checking" });
    if (canInstall) {
      try {
        await autoUpdater.checkForUpdates();
      } catch (error) {
        if (status.phase !== "error") await showUpdateError(error);
      }
      return;
    }

    try {
      const response = await fetch(RELEASES_API, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "taoqi-pet-updater" },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("GitHub releases HTTP " + response.status);
      const releases = await response.json();
      if (!Array.isArray(releases)) throw new Error("GitHub releases response is not a list");
      const release = newestRelease(releases, app.getVersion());
      manualCheck = false;
      if (release) {
        setStatus({ phase: "available", ...release });
        if (release.version !== previouslyAvailable) {
          announce("淘气桌宠有新版本", "发现 " + release.version + "，点击通知前往下载。", openRelease);
        }
        if (manual) await dialog.showMessageBox({
          type: "info",
          title: "发现新版本",
          message: "淘气桌宠 " + release.version + " 已发布。",
          detail: "当前安装包暂不支持原地安装，请到发布页下载。",
          buttons: ["稍后", "打开下载页"],
          defaultId: 1,
          cancelId: 0,
        }).then(({ response: choice }) => { if (choice === 1) openRelease(); });
      } else {
        setStatus({ phase: "idle" });
        if (manual) await dialog.showMessageBox({
          type: "info",
          title: "已是最新版本",
          message: "当前已是最新的淘气桌宠预览版。",
          buttons: ["知道了"],
        });
      }
    } catch (error) {
      await showUpdateError(error);
    }
  }

  function menuItems() {
    const items = [{ label: "检查更新…", click: () => check(true) }];
    if (status.phase === "downloading") {
      items.push({ label: "更新下载中 " + status.progress + "%", enabled: false });
    }
    if (status.phase === "ready") {
      items.push({ label: "重启安装 " + status.version, click: promptInstall });
    }
    if (status.phase === "available") {
      items.push({ label: "下载 " + status.version + "…", click: openRelease });
    }
    return items;
  }

  function start() {
    if (!app.isPackaged) return;
    firstCheckTimer = setTimeout(() => check(), 15000);
    repeatCheckTimer = setInterval(() => check(), CHECK_INTERVAL_MS);
  }

  function stop() {
    clearTimeout(firstCheckTimer);
    clearInterval(repeatCheckTimer);
  }

  return { check, menuItems, start, stop };
}

module.exports = { createUpdateManager };
