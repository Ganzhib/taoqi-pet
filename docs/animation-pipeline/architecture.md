# 透明动画管线（Animation Pipeline）架构

> **用途**：本期需求的技术设计与分期落地计划。需求背景与目标见 [`requirements.md`](requirements.md)。
> **状态**：设计阶段。M1 可直接开工，M2/M3 需按 M1 落地后的实测数据校准参数。

---

## 一、现状链路

```
assets/pets/<id>.gif
      │  fs.readFileSync → base64
      ▼
getArtwork(id) → "data:image/gif;base64,…"      [src/electron/main.js:191]
      │  IPC: pet:get-artwork / market:artwork
      ▼
useArtwork(characterId, getArtwork)            [src/ui/shared/useArtwork.ts]
      │
      ▼
<img src={artwork}>  ← Chromium 原生解码 GIF
```

**特点**：链路极短，零自研解码代码。
**问题**：GIF 的 1 bit 透明 → 边缘白晕；256 色 → 渐变色带；单张 349–467 KB。

## 二、目标链路

```
scripts/render-*.py  →  RGBA 帧序列（PNG）
      │
      ├─ ffmpeg（构建期，一次性）──► assets/pets/<id>.webm（VP9 + yuva420p alpha）
      │
      └─ Pillow ──────────────────► assets/pets/<id>.gif（保底/缩略图）

运行时：
resolveArtworkSource(id) → { kind, url }
      │  kind = "video"  →  <video src="pet://pets/x.webm" autoplay loop muted playsinline>
      │  kind = "gif"    →  <img src="pet://pets/x.gif">     ← 降级 / 缩略图
      ▼
ArtworkPlayer                       [src/ui/shared/ArtworkPlayer.tsx]
```

**收益**：8 bit alpha 边缘平滑、体积降 70%+、**运行时依赖不变**。

## 三、格式选型

| 格式 | alpha | 色彩 | 体积 | 运行时成本 | 结论 |
|---|---|---|---|---|---|
| **GIF**（现状） | 1 bit ❌ | 256 色 ❌ | 大 ❌ | 无 ✅ | 保底 |
| **APNG** | 8 bit ✅ | 24 bit ✅ | 大 ❌ | 无 ✅ | 备选，体积不理想 |
| **WebP 序列** | 8 bit ✅ | 24 bit ✅ | 中 | 自管时序 ⚠️ | M3 缓存格式 |
| **WebM VP9 alpha** | 8 bit ✅ | 24 bit ✅ | **小 ✅** | **无（Chromium 原生）✅** | **✅ 主路线** |

选 WebM VP9 alpha 的理由：**它是唯一同时满足「8 bit alpha + 小体积 + Chromium 零成本播放」的选项**。

## 四、M1：素材来源抽象层（零视觉变化）

### 目标
把「id → 素材」的解析与「素材怎么渲染」解耦，为换格式铺路。**行为完全不变**。

### 新增文件

**`src/electron/animation/artwork-source.js`**
```js
const SOURCE_KINDS = { gif: "gif", webm: "video", png: "image",
                       jpg: "image", webp: "image", svg: "image" };

// 内置角色：优先 webm，缺失则回退 gif
// 自定义宠物：按原扩展名；捏宠产物为 svg
// 返回 null 表示 id 不存在
function resolveArtworkSource(id) { /* → { id, kind, url, mime, frameCount, frameDelayMs } | null */ }

module.exports = { resolveArtworkSource, SOURCE_KINDS };
```

**`src/ui/shared/ArtworkPlayer.tsx`**
```tsx
type ArtworkSource = { kind: "gif" | "video" | "image"; url: string; /* … */ };
// kind === "video" → <video autoplay loop muted playsinline>
// 其余            → <img>
```

### 改动文件

| 文件 | 改动 |
|---|---|
| `src/electron/main.js` | `getArtwork` 内部改调 `resolveArtworkSource`；新增 `pet:get-artwork-source` IPC |
| `src/electron/preloads/pet.js` | 暴露 `getArtworkSource` |
| `src/ui/shared/contracts.ts` | 新增 `ArtworkSource` 类型与 `getArtworkSource` 声明 |
| `src/ui/pet/PetApp.tsx` | `<img>` → `<ArtworkPlayer>` |

### 验收
`npm run check` / `npm test` / `npm run smoke` 全绿；卡片数仍 13；桌宠视觉无变化。

---

## 五、M2：透明 WebM 主路线

### 5.0 实测结论（先定格式，再写代码）

在真机上用一张 542×636 的插画（柔边 + 投影 + 渐变，属于最难的用例）跑了 12 帧、280×320 的横评：

| 格式 | 体积 | Alpha | 结论 |
|---|---|---|---|
| GIF（现状） | 463.6 KB | 1 bit | 基线 |
| APNG | 1214.6 KB | 8 bit | ❌ 比 GIF 还大 2.6 倍 |
| 动图 WebP q80 | 216.2 KB | 8 bit | ❌ 只降 51%，够不到目标 |
| **WebM VP9 CRF30** | **30.7 KB** | **8 bit** | ✅ **-93%** |

APNG 输在 PNG 是**整帧无损**，而 GIF 的小体积恰恰是靠丢掉 alpha 分辨率换来的——想拿回 alpha 就得付出体积。WebP 帧间差分已经好很多，但仍是 51% 的量级。

> 这也是对三、格式选型里那张表的一次实测复核：WebM VP9 alpha 是唯一同时满足「8 bit alpha + 体积大幅下降 + Chromium 零成本播放」的选项。

### 5.1 素材脚本改造

新增 `scripts/pet_animation.py` 放公共编码逻辑，三个渲染脚本共用：

```python
save_webm(frames, path, duration_ms=95, crf=30)   # RGBA 帧序列 → 透明 WebM
decode_webm_frame(path, index=0)                  # 回读一帧，供对比图使用
```

`render-cat-gifs.py` / `render-friend-gifs.py` 的改动很小：原本直接对「调色板化后的帧」保存 GIF，现在改成先留一份 RGBA 帧，GIF 照旧，另外补一个 `.webm`。

编码命令（**关键参数不可省**）：
```bash
ffmpeg -y -framerate 1000/95 -i <tmpdir>/%04d.png \
  -c:v libvpx-vp9 -pix_fmt yuva420p \
  -b:v 0 -crf 30 -auto-alt-ref 0 -row-mt 1 -an \
  <output>.webm
```

- `-pix_fmt yuva420p`：保留 alpha 通道
- `-auto-alt-ref 0`：**VP9 带 alpha 时必需**，否则 altref 帧会破坏 alpha
- `-b:v 0 -crf 30`：恒定质量模式

**回读校验的坑**：ffmpeg 自带的原生 VP9 解码器**不还原 alpha**，直接 `ffmpeg -i x.webm out.png` 会得到全不透明的图。必须 `-c:v libvpx-vp9` 指定 libvpx 解码器，否则会误判成「alpha 丢了」。

### 5.2 素材地址：暂用 data URL，协议延后

原计划在 M2 注册 `pet://` 自定义协议绕开 asar。**实测后决定延后**：单段 WebM 只有 30–50 KB，base64 后约 40–67 KB，走 `<video src="data:video/webm;base64,...">` 完全够用，而自定义协议要额外处理 scheme 权限、asar 路径和打包目录，风险与收益不成比例。

M1 已经把「素材解析」和「渲染方式」拆开了，将来真需要换协议，只改 `artwork-source.js` 一处。

### 5.3 降级链

```
webm 存在且 <video> 能解码   →  <video>（8 bit alpha）
否则                         →  <img> 播 GIF（1 bit alpha，视觉回到旧观感）
否则                         →  空 src，与改造前 getArtwork 返回 null 一致
```

`ArtworkPlayer` 监听 `<video>` 的 `error`：记录失败的 URL，并调用已有的 `getArtwork` 取 GIF 兜底。换角色后 URL 变了，会自动重试视频。

### 5.4 市场缩略图仍用 GIF

市场首页同时铺 13 张卡，若每张都挂一个 `<video>` 就是 13 路解码，开销不划算。卡片继续用 GIF 缩略图，只有桌宠窗口（单实例）走 WebM。

### 5.5 实测收益（13 个内置角色）

| 分组 | GIF 合计 | WebM 合计 | 降幅 |
|---|---|---|---|
| 8 种橘白猫状态 | 3518 KB | 288 KB | -92% |
| 5 位动物伙伴 | 152 KB | 71 KB | -53% |
| **合计** | **3670 KB** | **359 KB** | **-90%** |

### 5.6 重新生成

```bash
python3 scripts/render-cat-gifs.py --source assets/source/catbuddy-reference.png --output assets/pets
python3 scripts/render-friend-gifs.py --output assets/pets
python3 scripts/render-pet-from-image.py --source <插画> --id <id> --output assets/pets --preview
```

`render-pet-from-image.py` 是新加的通用入口：抠图（软 alpha + 反解前景色 + 补内部空洞）→ 12 帧呼吸 → 同时输出 GIF 与 WebM，`--preview` 还会生成深浅背景与边缘放大的对比图。

### 验收
A2.1–A2.5（见 requirements.md）。重点：**黑/白双壁纸截图无白边**，总体积降 ≥70%（实测 -90%）。

---

## 六、M3：WebP 帧序列缓存 + 精确播放控制

### 为什么需要

`<video>` 满足不了三件事：**精确暂停在指定帧**、**循环接缝无停顿**、**逐帧回调**（拖拽悬空反馈要跟着帧走）。这些需要自己拿帧。

### 设计

```
首次播放 → 后台低优先级把 webm 抽成 12 帧 WebP
        → 写到 userData/frameseq/<assetKey>/0000.webp … 0011.webp
        → 写 meta.json 记 { mtime, size, frameCount, frameDelayMs }

二次播放 → 直接读帧 → <img> 预解码 → canvas 按 rAF 切换
```

- **assetKey**：`<id>-<mtime>-<size>`，素材一变缓存即失效，无需手动清理
- **缓存目录可安全删除**，删后自动重建
- **播放时机**：`rAF` + 时间累加，避免 `setInterval` 漂移

### 帧号契约（**硬性，必须遵守**）

```js
// ✅ 正确：由时间推导，丢帧不漂移
frameIndex = Math.floor(elapsedMs / frameDelayMs) % frameCount;

// ❌ 错误：用"已绘制次数"当帧号——一旦掉帧就永久偏移
frameIndex = (frameIndex + 1) % frameCount;
```

这是 dsh-pet 在 P1 复审里明确钉住的坑：**显示帧索引 ≠ 消费计数**，队列满丢帧之后两者不再相等。

---

## 七、M4：ffmpeg 运行时管线（**可选，默认不做**）

### 什么时候才需要

只有同时满足以下两条才启动：
1. M1–M3 已全部落地
2. 出现了 M3 解决不了的需求（典型：允许用户导入 mp4/webm 当桌宠素材）

### 如果做，模块划分

| 文件 | 职责 |
|---|---|
| `animation/ffmpeg-locator.js` | 定位 ffmpeg：优先打包二进制，回退系统 PATH |
| `animation/clip-decoder.js` | spawn 子进程，`-pix_fmt rgba` 解出 RGBA 原始帧 |
| `animation/frame-queue.js` | 有界队列 + 时间线帧号 + 反压（不是简单丢帧） |
| `animation/frameseq-cache.js` | WebP 序列缓存（M3 已有，复用） |
| `animation/decode-fanout.js` | 多窗口共享同一解码源 |
| `animation/session-guard.js` | 退出/关机时禁止新 spawn，回收既有进程 |

### 从 dsh-pet 借的 6 条经验

1. **帧号契约**：显示索引必须由时间推导，不能用消费计数
2. **进程内存爬升**：长寿 ffmpeg 进程会从 47MB 涨到 64MB，需在循环边界定期重建
3. **Windows 控制台闪现**：spawn 时带 `CREATE_NO_WINDOW`（对应 dsh 的 STARTUPINFO）
4. **关机时禁止 spawn**：Windows 会话销毁期间创建进程会 DLL 初始化失败（0xc0000142）并卡住关机；用 `before-quit` + `powerMonitor` 上 latch
5. **队列满要反压**：让管道写满阻塞 ffmpeg，而不是全速解码再丢帧
6. **白底反解时机**：若素材在白底上抠图，必须在有损编码**之前**反解

> 第 6 条对 taoqi-pet **不适用**：我们的素材由 Pillow 程序化生成，输出的就是干净 RGBA，没有白底预乘问题。这是照搬 Qt 方案会做的无用功之一。

---

## 八、风险与回退

| 风险 | 影响 | 应对 |
|---|---|---|
| `<video>` 在某些壁纸/缩放组合下透明失效 | 视觉 | M2 保留 GIF 降级链 |
| WebM 硬解在老机器上占用升高 | 性能 | M3 帧序列缓存兜底 |
| 打包后 asar 内视频读取失败 | 功能 | 用自定义协议，冒烟测试覆盖打包产物 |
| 素材脚本引入 ffmpeg 依赖，CI 构建变慢 | 工程 | ffmpeg 只在本地生成时调用，产物入库，CI 不转码 |

**回退**：M1/M2 都是增量改动，素材同时保留 GIF；出问题删掉 `resolveArtworkSource` 的 webm 分支即可回到原链路。

## 九、与既有约定的关系

- 素材仍由 `scripts/` 下脚本生成、产物入库，符合 ADR「脚本生成、产物入库」
- 新增角色依旧要同步 `assets/pets/<id>.*`、`pet-core.js` 的 `CHARACTERS`、`reactions.ts` 文案、冒烟测试卡片数
- 「学习中」分类保持 1 张卡，新角色不要放进去，否则冒烟测试挂（已在 v0.3.0 踩过一次）
