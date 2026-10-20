# 淘气桌宠开发约定

开始修改前先读 [产品与技术规划](docs/product-technical-plan.md) 和 [代码结构与命名约定](docs/code-structure.md)。桌宠的全部功能永久免费；简历、画图等外部产品只能由用户主动点击打开。

## 代码设计与产品规划

- 每次规划需求在/docs中产生需求文档以及对应的技术架构文档(归入一个文件夹)，针对已有需求的bugfix，直接在对应的文档修改即可，无需产生多余文件
- Readme中同步更新宏观层面的改动，不必体现具体细节
- 新增角色同时更新 `assets/pets/`、`src/electron/pet-core.js`、`src/ui/pet/reactions.ts` 与市场验收。

## 代码边界

- `src/electron/main.js` 管理窗口、菜单和 IPC；`settings-store.js` 是本地设置的唯一读写入口；`pet-core.js` 放纯函数与角色元数据。
- `src/electron/preloads/` 每个窗口一个桥接，只暴露页面确实需要的方法。React 页面不直接访问 Node、文件系统、Shell 或 Electron API。
- `src/ui/pet/`、`src/ui/market/`、`src/ui/home/` 按页面放组件、入口和样式；跨页面契约与 Hook 放 `src/ui/shared/`。
- 新组件用 PascalCase 文件名，Hook 用 `useXxx.ts`，资源与样式用小写或连字符。避免 `utils.ts`、`misc.ts` 等无职责边界的文件。
- 用户图片、设置文件和外部链接在主进程入口验证。信任已经建立的内部契约，不重复写猜测性的空值守卫。
- 所有定时器、事件订阅和拖拽状态都要有对应清理；动画遵守 `prefers-reduced-motion`。

## 发包部署

准备 package.json 版本和发行说明
  → 推送对应的 v* 标签
  → 自动创建 Release 草稿
  → Windows / macOS 并行构建
  → 上传安装包和自动更新清单
  → 校验必需资产
  → 自动公开正式 Release


## 验证与提交

- 提交前运行 `npm run check`、`npm test`；界面变更还需让 GitHub CI 的 Electron smoke test 通过。
- 安装包由 GitHub Actions 在 Windows、macOS 构建；不要把 `dist-ui/` 或 `dist/` 提交到仓库。
- 当前开发按仓库所有者要求直接提交 `main`，无需 PR。提交信息用 `<type>(<scope>): 中文具体描述`。
- 报告完成内容时区分：代码通过 CI、安装包构建成功、各系统实机验收。不能把其中一项当作另一项。
