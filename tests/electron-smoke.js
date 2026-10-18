const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _electron: electron } = require("playwright");

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "taoqi-smoke-"));

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
    await pet.waitForFunction(() => {
      const image = document.getElementById("pet-art");
      return image.complete && image.naturalWidth > 0;
    });

    assert.equal(await pet.title(), "淘气桌宠");
    await pet.locator("#pet").click();
    await pet.locator("#bubble.visible").waitFor();
    assert.ok(await pet.locator("#bubble").textContent());

    const marketOpened = application.waitForEvent("window");
    await pet.locator("#pet").press("m");
    const market = await marketOpened;
    market.on("pageerror", (error) => pageErrors.push("market: " + error.message));
    await market.locator(".pet-card").first().waitFor();
    assert.equal(await market.title(), "淘气宠物市场");
    assert.equal(await market.locator(".pet-card").count(), 8);

    await market.locator('[data-category="动漫感"]').click();
    assert.equal(await market.locator(".pet-card").count(), 3);
    await market.locator(".pet-card").filter({ hasText: "云朵龙" })
      .getByRole("button", { name: "选它陪伴" }).click();
    await pet.waitForFunction(() => document.getElementById("pet").dataset.character === "cloud-dragon");
    await pet.waitForFunction(() => document.getElementById("pet-art").naturalWidth > 0);
    await market.screenshot({ path: "artifacts/market.png" });
    await pet.screenshot({ path: "artifacts/pet.png" });

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
    await pet.waitForFunction(() => document.getElementById("pet").dataset.character === "caramel");

    const hidden = await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()
        .find((item) => item.webContents.getURL().endsWith("/src/index.html"));
      window.close();
      return !window.isDestroyed() && !window.isVisible();
    });
    assert.equal(hidden, true, "关闭桌宠窗口后应保留托盘中的进程");
    assert.deepEqual(pageErrors, []);
    process.stdout.write("Electron smoke test passed: pet, market, import, rename, delete, tray hide.\n");
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
