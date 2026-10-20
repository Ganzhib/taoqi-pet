# 桌宠动图与下载官网：技术设计

## 素材与桌宠

`assets/source/catbuddy-reference.png` 保存所有者提供的橘白猫原始透明图。可重复运行的 `scripts/render-cat-gifs.py` 用 Pillow 输出 280×320 的循环 GIF/WebM 以及 PNG、ICO、ICNS 图标；以原图为唯一猫身，不重新生成肢体。`scripts/render-friend-gifs.py` 输出企鹅、小奶猫、打工狗、泡泡龙、蹦蹦兔和云朵团子素材。

`pet-core.js` 保存 8 位当前内置角色元数据，默认角色为 `gugugaga-idle`。桌宠、市场和小窝通过统一的受控素材协议读取 GIF/WebM；用户上传接受 PNG/JPG/GIF/WebP，生成角色保存为 SVG。旧设置中的已下架角色 ID 由设置存储迁移到当前默认角色。

置顶操作由主进程单一函数负责：Windows/macOS 设定高窗口层级，macOS 追加所有空间和全屏可见选项。菜单切换和首次窗口创建共用该函数；窗口隐藏、显示和退出保持原有生命周期。

## 内置工具窗口

“我的工具”菜单创建独立 BrowserWindow，按用户操作加载 https://next.ganzhibin.icu/ 。窗口关闭后销毁，再次点击时重新创建；重复点击则聚焦现有窗口。独立持久会话保留工具铺登录状态，禁用 Node 集成并开启沙箱。工具铺站内导航保持在 Electron 内，外部 HTTP(S) 与邮件链接交给系统默认应用。桌宠启动时不自动请求工具铺。

## 官网信息架构与交互

`site/` 只有 HTML/CSS/JS，页面不请求自有服务。官网按照“可自定义定位 → 角色阵容 → 三种获得角色的方式 → 系统下载”组织信息：

- 首屏默认展示 `gugugaga-idle.gif`，标题与说明以咕咕嘎嘎为项目主品牌。
- 导航品牌位使用 `assets/brand/gugugaga-avatar.png` 头部头像，不把全身素材缩成商标。
- 角色阵容使用 7 张可点击卡片，通过 `data-image`、`data-symbol` 和 `data-caption` 驱动同一个预览区域；橘白猫与其他角色同级。
- 第 8 张静态卡片表示“导入或捏宠”，不伪装成官网可执行的上传入口。
- 品牌区域用纯 HTML/CSS 字标，避免应用的动物图标成为官网唯一品牌形象。
- 开启 `prefers-reduced-motion` 时隐藏 GIF，用每个角色的数据符号代替动画；CSS 动画和过渡同时降至最低。

静态发布步骤把 `site/index.html`、`site/styles.css`、`site/main.js` 和 `assets/pets/*-idle.gif` 复制到发布目录，并断言恰好存在 7 个当前内置角色的待机 GIF。下载按钮固定指向当前正式版 GitHub Release 资产。页面支持键盘操作和响应式布局。

## 官网与发行发布

GitHub Actions 在 Windows/macOS 构建未签名安装包并发布 Release。下载官网只由本仓库的 `.github/workflows/deploy-pages.yml` 自动发布到 GitHub Pages。工作流组装静态页面与本地角色素材后使用 GitHub Pages 官方 Action 发布，不持有 SSH 私钥，不连接独立服务器，也不管理 Nginx、DNS 或域名证书。

## 图标完整性校验

`package.json` 明确指定 macOS 应用与 DMG 的 ICNS、Windows 应用与 NSIS 安装程序的 ICO。`scripts/check-app-icons.js` 在 `npm run check` 中验证 ICNS 头部总长度和图像块边界，并验证 ICO 图像索引；若仓库中的二进制资源被截断，CI 和发布构建会在打包前失败。此校验针对应用资源文件，不代替 Windows/macOS 实机图标验收，也不决定官网的角色定位。
