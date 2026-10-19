# 透明动画管线（Animation Pipeline）需求

> **用途**：把桌宠动画从 GIF 升级为带 alpha 通道的透明格式，消除边缘锯齿与白晕，同时压掉安装包体积。
> **状态**：设计阶段，尚未开工。分期计划与模块划分见 [`architecture.md`](architecture.md)。
> **互链**：[`../code-structure.md`](../code-structure.md)、[`../friend-pets/requirements.md`](../friend-pets/requirements.md)、[`../auto-update/requirements.md`](../auto-update/requirements.md)。

---

## 一、背景

内置桌宠动画目前全部是 GIF：`assets/pets/<id>.gif`，统一规格 280×320、12 帧、95 ms/帧。渲染链路是主进程把文件读成 data URL，过 IPC 交给渲染进程的 `<img>`，由 Chromium 原生解码播放。

这条链路的三个固有短板，**全部来自 GIF 格式本身**，跟代码写得怎么样无关：

1. **透明只有 1 bit**。每个像素要么全透要么不透，没有中间态。角色边缘（毛、发丝、光晕）叠在深色壁纸上会留一圈白晕，叠在浅色壁纸上会留一圈暗边——这是桌宠最扎眼的瑕疵，因为它永远悬在任意背景之上。
2. **颜色只有 256 色**。带渐变的素材量化后会出现明显色带。
3. **压缩率低**。现有 8 个橘白猫 GIF 合计约 3.4 MB，单张 349–467 KB。

> 一个佐证：后加的 5 位动物伙伴 GIF 只有 21–34 KB，比猫小一个数量级。原因是程序化生成的画面是大色块，GIF 对平色压缩极其友好。这说明**体积差距的来源是素材色彩复杂度，不是生成脚本**——反过来说，越是渐变丰富、越接近真实素材的画面，GIF 的劣势越明显。

## 二、一个必须先纠正的前提

参照项目 `dsh-pet-indesktop` 用的是 **WebM（VP9 alpha）+ 自建 ffmpeg 解码管线**。它之所以必须自己拉 ffmpeg 子进程逐帧抽取，是因为它是 **Qt/PySide** 项目：Qt 的多媒体后端不给逐帧控制，也不保证各平台透明视频表现一致，只能自己来。为此它付出了 `webm_clip.py` 3051 行、`overlay_shell.py` 7682 行的代价。

**taoqi-pet 是 Electron，不走这条路。** Chromium 原生就能播放带 alpha 通道的 VP8/VP9 WebM，一个 `<video autoplay loop muted playsinline>` 标签即可，浏览器内部照常走平台硬件解码，还能用 `playbackRate` 变速。

因此本项目的路径是：**ffmpeg 只在构建期把帧序列编码成透明 WebM 一次，运行时零新增依赖。** 下方 M4 仍保留了完整 ffmpeg 运行时管线的设计，但它是**可选项**，只在 M3 满足不了需求时才动。

## 三、目标

- **G1 视觉**：动画边缘为 8 bit alpha（256 级），任意壁纸下无白边、无锯齿。
- **G2 体积**：内置素材总体积在观感不下降的前提下压掉 70% 以上。
- **G3 兼容**：既有 GIF、用户已导入的自定义宠物，行为完全不变。
- **G4 可控**：支持变速播放、暂停、循环接缝不卡顿（M3 达成）。
- **G5 依赖**：运行时不引入 ffmpeg 子进程，不动打包配置。
- **G6 可复现**：透明素材同 GIF 一样由仓库脚本生成，不手写二进制入库。

## 四、非目标

- **N1** 不支持用户导入视频（mp4/webm）当桌宠——暂不做，见 architecture M4。
- **N2** 不替换可视化捏宠的 SVG 路径（`character-generator.js`），它本来就是矢量、无锯齿。
- **N3** 不做多宠物同屏的共享解码优化——主窗口当前只有一个宠物。
- **N4** 不追求更高规格（4K / 60fps），维持 280×320、12 帧、95 ms。

## 五、约束

- **C1** Electron 42 / Chromium 可直接播放带 alpha 的 VP9 WebM，无需额外解码器。
- **C2** 素材随 `assets/**` 打进 asar；`<video>` 读 asar 内文件需要自定义协议中转（`file://` 直读在 asar 内不可靠）。
- **C3** `getArtwork(id)` 现有返回值为 data URL 字符串，改造期必须保持向后兼容。
- **C4** 冒烟测试断言市场卡片数为 13、「学习中」分类只有 1 张卡；新增格式不得破坏这两条。
- **C5** 素材脚本沿用 Pillow + ffmpeg，保持「脚本生成、产物入库」的既有约定。
- **C6** 不把仓库/素材下载到本地工作区，改动通过 GitHub API 直接提交。

## 六、分期

| 期 | 内容 | 视觉变化 | 运行时依赖 |
|---|---|---|---|
| M1 | 素材来源抽象层 | 无 | 无变化 |
| M2 | 透明 WebM 主路线 + 自定义协议 | 边缘平滑、体积下降 | 无变化 |
| M3 | WebP 帧序列缓存 + 精确播放控制 | 支持变速/暂停/无缝循环 | 无变化 |
| M4 | ffmpeg 运行时管线（可选） | 可导入视频素材 | **新增 ffmpeg** |

## 七、验收

### M1（抽象层）

- A1.1 `src/electron/animation/artwork-source.js` 可提供 `resolveArtworkSource(id)`，返回 `{ kind, url, frameCount, frameDelayMs }`。
- A1.2 对 13 个内置 id 全部返回 `kind === "gif"` 且 `url` 非空。
- A1.3 `npm run check`、`npm test`、`npm run smoke` 全部通过；市场卡片数仍为 13。
- A1.4 桌宠窗口视觉与改造前逐帧一致（无回归）。

### M2（透明 WebM）

- A2.1 `assets/pets/<id>.webm` 13 个全部存在，可用 `ffprobe` 验出 `pix_fmt=yuva420p`（含 alpha）。
- A2.2 桌宠窗口渲染走 `<video>`，在纯黑与纯白两种壁纸下截图均无白边/暗边。
- A2.3 内置素材总体积较 M1 下降 ≥70%。
- A2.4 webm 缺失或解码失败时自动回退 `<img>` 播 GIF，不出现空白/崩溃。
- A2.5 冒烟测试仍为 13 张卡，且新增一条断言：页面中存在可播放的 `<video>` 元素。

### M3（帧序列缓存 + 播放控制）

- A3.1 首次播放某角色后，`userData/frameseq/<id>/` 下生成 12 个 WebP 帧；二次播放直接命中，不再启动视频解码。
- A3.2 素材文件 mtime/size 变化时缓存自动失效重建。
- A3.3 `playbackRate` 在 0.5×–2× 区间生效，循环接缝无明显停顿。
- A3.4 缓存目录可安全删除，删除后自动重建。

### M4（可选）

- A4.1 仅在 M1–M3 全部落地且仍有「导入视频素材」需求时启动，需单独评审。
