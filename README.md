# 淘气桌宠

一只轻量、免费的桌面小伙伴。启动后就能看到宠物；单击、双击或长按会得到不同回应，拖动可以换位置，右键或从系统托盘可以切换角色与装扮、开启安静模式、开始专注或退出。聚焦宠物后按 M 可以打开宠物市场，按 H 可以进入淘气小窝。所有桌宠功能均免费，无需账号，基础互动可离线使用。

需要简历、画图等工具时，可由用户从菜单的“我的工具”在 Electron 内置窗口打开[淘气工具铺](https://next.ganzhibin.icu/)。

## 当前功能

- Windows、macOS 桌面窗口支持
- 透明置顶窗口、macOS 全屏空间显示、拖动、单击/双击/长按反馈、待机、低频游走，以及可随“暂停自主活动”关闭的打盹和玩耍
- 宠物市场提供橘白打工猫的八种循环 GIF 状态，以及小奶猫、打工狗、泡泡龙、蹦蹦兔、云朵团子五位动物伙伴的基础形态；全部免费
- 支持可视化捏宠：自由组合小猫、小龙、团子造型、颜色与表情；也能导入自己的 PNG、JPG、GIF、WebP 图片，静态图片导入时自动抠图，只保留宠物主体。作品保存在本机，可改名或删除
- 淘气小窝支持三种场景、五件家具、抱抱/跳舞/打盹，以及免费的 20 秒抓鱼小游戏；小窝布置和最佳成绩只保存在本机
- 星星、蝴蝶结和小花等免费装扮
- 可主动喂小鱼、陪玩或夸夸它；没有饥饿值、签到或付费解锁
- 暂停游走、安静模式、置顶、调整大小、可恢复的 25 分钟专注计时
- 关闭宠物窗口时隐藏到系统托盘，可随时唤回；单实例运行并记住上次位置
- 打包后可在 macOS 和 Windows 菜单中选择开机启动
- 本地保存偏好与专注结束时间，不收集屏幕、文件或浏览记录
- 固定的工具铺入口，只有用户点击后才在独立的 Electron 窗口打开
- 安装版启动后定期检查版本；Windows 安装版后台下载并在退出或确认重启时原地更新，macOS 和 Windows 便携版发现新版后提示下载

## 运行

需要 Node.js 22.12 或更新版本。界面使用 React、TypeScript 和 Vite；Electron 主进程与预加载脚本按运行边界分离。

    npm install
    npm start

检查代码与核心逻辑：

    npm run check
    npm test

开发环境中的真实窗口验收（CI 在 Linux 图形环境自动执行）：

    xvfb-run -a npm run smoke

验收使用临时用户数据目录，会实际执行选宠、导入、改名、删除与关闭窗口操作，并把截图写到 `artifacts/`。

生成当前系统的安装包：

    npm run dist

也可在 GitHub Actions 的 “Build desktop packages” 运行记录中下载 Windows 和 macOS 的测试构建。当前可访问的下载官网为 [GitHub Pages 预览站](https://ganzhib.github.io/taoqi-pet/)；独立域名 `pet.ganzhibin.icu` 待服务器部署完成后启用。

产品定位、技术设计与后续任务见[产品与技术规划](docs/product-technical-plan.md)。新增页面和角色时请遵循[代码结构与命名约定](docs/code-structure.md)。

## 发布状态

[v0.3.0-preview.3 预览版](https://github.com/Ganzhib/taoqi-pet/releases/tag/v0.3.0-preview.3) 提供 Windows 和 macOS 未签名安装包，修复 macOS 应用图标，并保留版本提醒。Windows 安装版可从 preview.2 自动更新到本版；已安装的 preview.1 需要手动安装新版一次。macOS 尚未公证，两个平台都可能出现系统安全提示。发布构建与真实设备安装验证分别记录；尚未完成的实机验收会继续推进。

更新机制的适用范围和发布流程见[自动更新设计](docs/auto-update/requirements.md)。本地数据与外部链接说明见[隐私说明](docs/privacy.md)。

## 许可

代码采用 MIT 许可，见 [LICENSE](LICENSE)。内置 GIF 角色与图标由仓库所有者提供的橘白猫形象制作，没有导入第三方动漫角色素材。用户自行导入的图片保留在本机，不属于仓库内置素材。

角色动图由 `scripts/render-cat-gifs.py` 从 `assets/source/catbuddy-reference.png` 生成；下载官网源码位于 `site/`。本版的动图与官网设计见 [需求和技术设计](docs/cat-gif-download-site/requirements.md)。
