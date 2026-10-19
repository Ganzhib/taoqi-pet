# 代码结构与命名约定

这份约定用于新增桌宠功能、角色和页面。目录按运行边界划分，再按页面划分，避免把所有逻辑继续放进 `src` 根目录。

```text
assets/
  pets/                 内置角色动画：WebM（主路线，8 bit alpha）+ GIF（降级/缩略图）
assets/source/          原始参考图
build/                  Windows/macOS 应用图标
src/
  electron/
    main.js             Electron 生命周期、菜单、窗口与 IPC 注册
    pet-core.js         无 Electron 依赖的业务常量与纯函数
    character-generator.js 受控选项生成原创 SVG 角色
    settings-store.js   本地偏好的默认值、读取与保存
    animation/
      artwork-source.js 角色 id → 素材描述（格式优先级、编码缓存）
      protocol.js       pet:// 自定义协议，供 <video> 加载透明素材
    preloads/
      pet.js            桌宠窗口的最小桥接
      market.js         市场窗口的最小桥接
      home.js           小窝窗口的最小桥接
  ui/
    index.html          桌宠页面入口
    market.html         市场页面入口
    home.html           小窝页面入口
    pet/
      main.tsx          React 挂载入口
      PetApp.tsx        桌宠界面与交互
      reactions.ts      角色台词
      pet.css           桌宠视觉与动画
    market/
      main.tsx
      MarketApp.tsx
      CreatorPanel.tsx    可视化造型、颜色和表情选择
      market.css
    home/
      main.tsx
      HomeApp.tsx
      home.css
    shared/
      contracts.ts      三个 preload 桥接的 TypeScript 契约
      useArtwork.ts     跨页面共用的图片加载 Hook
      ArtworkPlayer.tsx 按素材类型渲染 <video> 或 <img>，失败自动降级
site/                   静态下载官网，发布时复制 GIF 与图标
scripts/
  render-cat-gifs.py    从原始参考图生成猫咪 GIF/WebM 与应用图标
  render-friend-gifs.py 程序化生成五位动物伙伴的 GIF/WebM
  render-gugugaga-gifs.py 从 3×3 逐帧表批量生成咕咕嘎嘎九套肢体动作 GIF/WebM
  render-brand-icons.py 从咕咕嘎嘎头像生成应用与安装包图标
  render-pet-from-image.py 把任意插画抠图并生成 GIF/WebM
  pet_animation.py      RGBA 帧序列 → 透明 WebM 的公共编码逻辑
tests/
  pet-core.test.js      纯函数与关键不变量
  electron-smoke.js     真实窗口用户流程
```

`dist-ui/` 是 Vite 生成的界面产物，由 `npm run build:ui` 生成，不提交到 Git。Electron 开发启动和安装包构建都会先生成它。

## 命名

- 目录、小写资源与样式文件使用小写或连字符：`preloads/`、`pet-core.js`、`pet.css`。
- React 组件文件和组件名使用 PascalCase：`MarketApp.tsx`、`PetCard`。
- Hook 使用 `useXxx.ts`；纯函数使用清楚的动词或领域名，避免 `utils.ts`、`helpers.ts` 这样的杂物文件。
- 每个页面的 `main.tsx` 只负责挂载。状态、交互和生命周期放在页面组件或按职责拆出的 Hook 中。
- IPC 频道按页面或领域命名：`pet:...`、`market:...`、`home:...`。preload 对外使用动词方法，不把 `ipcRenderer` 暴露给 React。

## 边界

- React 页面不直接访问 Node、文件系统、Shell 或 Electron API；通过 `window.taoqiPet`、`window.petMarket`、`window.taoqiHome` 调用 preload 的有限能力。
- 主进程拥有持久设置、窗口、文件副本和外部链接；`settings-store.js` 是持久偏好的唯一读写位置。页面只拥有临时界面状态，例如选中的筛选条件或一局游戏的倒计时。
- 对用户图片、持久设置和外部链接在主进程入口验证。已经由类型和内部协议保证的数据，不在每层重复检查。
- 订阅、定时器和拖拽各有明确的创建与清理位置。角色切换时的异步图片读取应忽略过期结果。
- 所有宠物功能保持免费；外部产品只能由用户主动点击打开。

## 增加功能

1. 新增角色：把有公开分发权的循环 GIF 放到 `assets/pets/`，在 `src/electron/pet-core.js` 增加元数据，并在 `src/ui/pet/reactions.ts` 配置台词。
2. 新增页面：在 `src/ui/<page>/` 建 React 入口、组件与局部样式；创建同名 HTML；仅在确实需要主进程能力时新增 preload 方法和 IPC。
3. 修改本地设置：在主进程补默认值与读取迁移，再为对应页面更新 `src/ui/shared/contracts.ts`。不要把设置副本放进多个存储位置。
4. 增加交互：先保证键盘可操作与 `prefers-reduced-motion`，再用 `tests/electron-smoke.js` 覆盖一条真实用户路径。
5. 提交前执行 `npm run check`、`npm test`；涉及界面时执行 `xvfb-run -a npm run smoke` 或查看 CI 的对应结果。

Git 提交遵循 `<type>(<scope>): 中文描述`。当前项目按用户要求直接提交 `main`，无需 PR。
