const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _electron: electron } = require("playwright");

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "taoqi-smoke-"));

// 等桌宠素材真正可显示：视频要求解出首帧，图片要求解码完成。
// 失败时把播放器的内部状态一起抛出来，否则 CI 只能看到一句 timeout。
async function waitForArtwork(page, label) {
  await page.waitForFunction(() => {
    const element = document.getElementById("pet-art");
    if (element instanceof HTMLVideoElement) {
      return element.readyState >= 2 && element.videoWidth > 0 && element.error === null;
    }
    return element.complete && element.naturalWidth > 0;
  }, undefined, { polling: 200, timeout: 20000 }).catch(async (error) => {
    const state = await page.evaluate(() => {
      const element = document.getElementById("pet-art");
      if (element instanceof HTMLVideoElement) {
        return {
          kind: "video",
          readyState: element.readyState,
          networkState: element.networkState,
          videoWidth: element.videoWidth,
          error: element.error ? element.error.code + ":" + element.error.message : null,
          src: element.src.slice(0, 24),
        };
      }
      return {
        kind: "img",
        complete: element.complete,
        naturalWidth: element.naturalWidth,
        src: String(element.getAttribute("src")).slice(0, 24),
      };
    });
    throw new Error(label + " 未就绪 " + JSON.stringify(state) + " | " + error.message);
  });
}

// 拿一份 WebM 主源单独试播，把解码结果和角落 alpha 读回来。
// 桌宠元素一旦降级成 <img> 就再也读不到视频状态了，只能另起一个 video 探测。
async function probeWebm(page) {
  return await page.evaluate(async () => {
    let source;
    try {
      source = await window.taoqiPet.getArtworkSource("cat-idle");
    } catch (error) {
      return { note: "取主源失败: " + error.message };
    }
    if (!source || source.kind !== "video") {
      return { note: "主源不是视频", kind: source && source.kind };
    }
    const video = document.createElement("video");
    video.muted = true;
    video.autoplay = true;
    video.preload = "auto";
    video.src = source.url;
    document.body.appendChild(video);
    await new Promise((resolve) => {
      video.onerror = resolve;
      video.onloadeddata = resolve;
      setTimeout(resolve, 8000);
    });
    let cornerAlpha = null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 280;
      canvas.height = 320;
      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0);
      cornerAlpha = context.getImageData(2, 2, 1, 1).data[3];
    } catch (error) {
      cornerAlpha = "draw-failed:" + error.message;
    }
    return {
      readyState: video.readyState,
      networkState: video.networkState,
      videoWidth: video.videoWidth,
      error: video.error ? video.error.code + ":" + video.error.message : null,
      cornerAlpha,
    };
  });
}

async function run() {
  const application = await electron.launch({
    args: ["."],
    env: { ...process.env, XDG_CONFIG_HOME: profile },
  });
  const pageErrors = [];

  try {
    const userData = await application.evaluate(({ app }) => app.getPath("userData"));
    assert.ok(userData.startsWith(profile + path.sep), "验收必须使用隔离的用户数据目录");
    const pet = await application.firstWindow();
    pet.on("pageerror", (error) => pageErrors.push("pet: " + error.message));
    await pet.locator("#pet-art").waitFor();
    await waitForArtwork(pet, "首屏桌宠素材");

    assert.equal(await pet.title(), "淘气桌宠");
    assert.equal(await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isAlwaysOnTop()), true);
    await pet.locator("#pet").click();
    await pet.locator("#bubble.visible").waitFor();
    assert.ok(await pet.locator("#bubble").textContent());

    const marketOpened = application.waitForEvent("window");
    await pet.locator("#pet").press("m");
    const market = await marketOpened;
    market.on("pageerror", (error) => pageErrors.push("market: " + error.message));
    await market.locator(".pet-card").first().waitFor();
    assert.equal(await market.title(), "淘气宠物市场");
    assert.equal(await market.locator(".pet-card").count(), 13);

    await market.locator('[data-category="学习中"]').click();
    assert.equal(await market.locator(".pet-card").count(), 1);
    await market.locator(".pet-card").filter({ hasText: "冲刺猫" })
      .getByRole("button", { name: "选它陪伴" }).click();
    await pet.waitForFunction(() => document.getElementById("pet").dataset.character === "cat-study");
    await waitForArtwork(pet, "切换后的桌宠素材");
    const isVideo = await pet.evaluate(() =>
      document.getElementById("pet-art") instanceof HTMLVideoElement);
    if (!isVideo) {
      assert.fail("内置宠物应当播放透明 WebM，却回退到了图片。视频试播结果: "
        + JSON.stringify(await probeWebm(pet)));
    }
    assert.ok((await pet.locator("#pet-art").getAttribute("src")).startsWith("data:video/webm"));
    await market.screenshot({ path: "artifacts/market.png" });
    await pet.screenshot({ path: "artifacts/pet.png" });

    await application.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1 });
    });
    await market.locator("#open-creator").click();
    await market.locator("#creator-name").fill("星星团子");
    await market.getByRole("radio", { name: "团子" }).check();
    await market.getByRole("radio", { name: "星星眼" }).check();
    await market.locator("#create-pet").click();
    await market.waitForFunction(() =>
      document.querySelector(".pet-card h2")?.textContent === "星星团子"
    );
    await pet.waitForFunction(() =>
      document.getElementById("pet-art").src.startsWith("data:image/svg+xml")
    );
    await market.getByRole("button", { name: "删除星星团子" }).click();
    await market.locator(".empty").waitFor();

    const imagePath = path.join(process.cwd(), "assets/icon.png");
    await application.evaluate(({ dialog }, filePaths) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths });
    }, [imagePath]);
    await market.locator("#import-pet").click();
    await market.locator(".pet-card h2").first().waitFor();
    await market.waitForFunction(() =>
      document.querySelector('[data-category="我的创作"]').getAttribute("aria-pressed") === "true" &&
      document.querySelectorAll(".pet-card").length === 1
    );
    await pet.waitForFunction(() => document.getElementById("pet").dataset.character.startsWith("custom-"));
    await pet.waitForFunction(() => document.getElementById("pet-art").src.startsWith("data:image/png"));

    await market.getByRole("button", { name: "改名" }).click();
    await market.locator(".name-editor input").fill("测试伙伴");
    await market.getByRole("button", { name: "保存" }).click();
    await market.waitForFunction(() => document.querySelector(".pet-card h2")?.textContent === "测试伙伴");

    await application.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1 });
    });
    await market.getByRole("button", { name: "删除测试伙伴" }).click();
    await market.locator(".empty").waitFor();
    await pet.waitForFunction(() => document.getElementById("pet").dataset.character === "cat-idle");

    await market.close();
    const homeOpened = application.waitForEvent("window");
    await pet.locator("#pet").press("h");
    const home = await homeOpened;
    home.on("pageerror", (error) => pageErrors.push("home: " + error.message));
    await home.locator("#room-pet-art").waitFor();
    await home.waitForFunction(() => document.getElementById("room-pet-art").naturalWidth > 0);
    assert.equal(await home.title(), "淘气小窝");

    await home.locator('#theme-options [data-theme="night"]').click();
    await home.locator('#furniture-options [data-furniture="basket"]').click();
    await home.waitForFunction(() =>
      document.getElementById("room").dataset.theme === "night" &&
      document.getElementById("furniture").dataset.furniture === "basket"
    );
    await home.getByRole("button", { name: "抱抱" }).click();
    await home.locator('#room-pet[data-reaction="hug"]').waitFor();
    await home.getByRole("button", { name: "开始抓鱼" }).click();
    await home.getByRole("button", { name: "抓住小鱼" }).click();
    await home.getByRole("button", { name: "结束本局" }).click();
    await home.waitForFunction(() => document.getElementById("best-score").textContent === "最佳 1 条");
    await home.screenshot({ path: "artifacts/home.png" });

    await home.close();
    const homeReopened = application.waitForEvent("window");
    await pet.locator("#pet").press("h");
    const savedHome = await homeReopened;
    savedHome.on("pageerror", (error) => pageErrors.push("home: " + error.message));
    await savedHome.waitForFunction(() =>
      document.getElementById("room").dataset.theme === "night" &&
      document.getElementById("furniture").dataset.furniture === "basket" &&
      document.getElementById("best-score").textContent === "最佳 1 条"
    );

    const hidden = await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()
        .find((item) => item.webContents.getURL().endsWith("/dist-ui/index.html"));
      window.close();
      return !window.isDestroyed() && !window.isVisible();
    });
    assert.equal(hidden, true, "关闭桌宠窗口后应保留托盘中的进程");
    assert.deepEqual(pageErrors, []);
    process.stdout.write("Electron smoke test passed: pet, market, creator, import, rename, delete, home, game, tray hide.\n");
  } finally {
    await application.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

fs.mkdirSync("artifacts", { recursive: true });
run().catch((error) => {
  process.stderr.write(error.stack + "\n");
  process.exitCode = 1;
});
