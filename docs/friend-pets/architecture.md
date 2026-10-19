# 动物伙伴扩展与导入自动抠图 · 技术设计

对应需求：`docs/friend-pets/requirements.md`。

## 素材生产

`scripts/render-friend-gifs.py` 与 `scripts/render-cat-gifs.py` 同管线：PIL 逐帧绘制后量化调色板，保留索引 255 作为透明色。规格与现有 GIF 一致：280×320、12 帧、95ms/帧、无限循环。

五个绘制函数（`draw_kitty` / `draw_doggy` / `draw_dragon` / `draw_bunny` / `draw_blob`）只画宠物本体，不画道具、文字和底板。每帧动画由 `wave`（一帧一步的正弦）驱动：小奶猫会眨眼（第 5、6 帧改画闭眼弧线），打工狗摇尾巴、吐舌头，泡泡龙悬停扇翅、尾尖带爱心，蹦蹦兔双耳摆动，云朵团子做挤压呼吸。

`tighten()` 先求 12 帧的并集 bounding box，再加 8px 内边距整体平移居中，保证没有任何元素探出画布，也不会出现逐帧抖动。

## 注册链路

新增一个内置角色只需两处，测试会自动兜底：

1. `assets/pets/<id>.gif`：动图文件。
2. `src/electron/pet-core.js` 的 `CHARACTERS`：`{ id, name, category, description }`。

`main.js` 的 `getArtwork(id)` 把内置 id 解析到 `assets/pets/<id>.gif` 并转成 data URL，市场、桌宠、小窝三个窗口共用。互动文案在 `src/ui/pet/reactions.ts` 按 id 查找，缺失回退到 `cat-idle`。`tests/pet-core.test.js` 遍历 `CHARACTERS` 校验每个角色都有合法 GIF。

## 导入自动抠图

`src/electron/cutout.js`，纯 JS、零新增依赖，完全本地运行：

1. `borderSeeds()`：沿四条边采样，按颜色距离（逐通道 ≤ 42）贪心聚类，只保留覆盖 ≥ 2% 边缘像素的种子色，避免个别杂点放大背景范围。
2. 洪水填充：从所有匹配种子色或已透明的边缘像素向内扩散；内部同色口袋（如白肚子）不连通边界，因此保留。
3. 守卫：去除比例需在 3%–99.5% 之间；保留区域必须连成一体（最大连通块 ≥ 保留像素的 60%），防止种子过宽把宠物本身吃掉、只剩碎屑。任一不满足返回 `null`，调用方保留原图。
4. 解码编码走 Electron `nativeImage`：`createFromBuffer` → `getBitmap` → 改 alpha → `createFromBitmap` → `toPNG`。算法只按 4 字节/像素、alpha 在末字节处理，因此 BGRA/RGBA 字节序均可。超过 2400px 的边长先 `resize` 再扫描。

`main.js` 的 `importCustomPet()`：静态图片先尝试抠图，成功则以 PNG 落库（`extension` 记为 `png`），失败按原样落库；GIF 直接按原样落库。返回值从 `id` 改为 `{ id, cutout }`，`contracts.ts` 的 `MarketBridge.importPet` 同步更新，市场页据此显示两种提示。

## 已知限制

- 抠图对纯色、渐变背景效果最好；宠物颜色与背景接近时可能被部分吃掉，此时连通性守卫会拒绝并保留原图。
- GIF 逐帧抠图需要 GIF 编解码依赖，本期不做，后续在本文档补充评估。

## 隐私

导入图片、抠图、保存全部在本地完成，不上传、不联网。
