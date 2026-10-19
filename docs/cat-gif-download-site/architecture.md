# 桌宠动图与下载官网：技术设计

## 素材与桌宠

`assets/source/catbuddy-reference.png` 保存所有者提供的橘白猫原始透明图。可重复运行的 `scripts/render-cat-gifs.py` 用 Pillow 输出 280×320 的循环 GIF/WebM 以及 PNG、ICO、ICNS 图标；以原图为唯一猫身，不重新生成肢体。`scripts/render-friend-gifs.py` 输出企鹅、小奶猫、打工狗、泡泡龙、蹦蹦兔和云朵团子素材。

`pet-core.js` 保存 7 位当前内置角色元数据，默认角色为 `penguin-idle`。桌宠、市场和小窝通过统一的受控素材协议读取 GIF/WebM；用户上传接受 PNG/JPG/GIF/WebP，生成角色保存为 SVG。旧设置中的已下架角色 ID 由设置存储迁移到当前默认角色。

置顶操作由主进程单一函数负责：Windows/macOS 设定高窗口层级，macOS 追加所有空间和全屏可见选项。菜单切换和首次窗口创建共用该函数；窗口隐藏、显示和退出保持原有生命周期。

## 内置工具窗口

“我的工具”菜单创建独立 BrowserWindow，按用户操作加载 https://next.ganzhibin.icu/ 。窗口关闭后销毁，再次点击时重新创建；重复点击则聚焦现有窗口。独立持久会话保留工具铺登录状态，禁用 Node 集成并开启沙箱。工具铺站内导航保持在 Electron 内，外部 HTTP(S) 与邮件链接交给系统默认应用。桌宠启动时不自动请求工具铺。

## 官网信息架构与交互

`site/` 只有 HTML/CSS/JS，页面不请求自有服务。官网按照“可自定义定位 → 角色阵容 → 三种获得角色的方式 → 系统下载”组织信息：

- 首屏默认展示 `penguin-idle.gif`，标题与说明不绑定具体动物。
- 角色阵容使用 7 张可点击卡片，通过 `data-image`、`data-symbol` 和 `data-caption` 驱动同一个预览区域；橘白猫与其他角色同级。
- 第 8 张静态卡片表示“导入或捏宠”，不伪装成官网可执行的上传入口。
- 品牌区域用纯 HTML/CSS 字标，避免应用的动物图标成为官网唯一品牌形象。
- 开启 `prefers-reduced-motion` 时隐藏 GIF，用每个角色的数据符号代替动画；CSS 动画和过渡同时降至最低。

静态发布步骤把 `site/index.html`、`site/styles.css`、`site/main.js` 和 `assets/pets/*-idle.gif` 复制到发布目录，并断言恰好存在 7 个当前内置角色的待机 GIF。下载按钮固定指向当前正式版 GitHub Release 资产。页面支持键盘操作和响应式布局。

## 官网与发行发布

GitHub Actions 在 Windows/macOS 构建未签名安装包并发布 Release。下载官网由本仓库的 `.github/workflows/deploy-pages.yml` 自动发布 GitHub Pages；`.github/workflows/deploy-site.yml` 负责独立域名的手动部署。

独立域名工作流用本仓库 `production` 环境的专用 `SITE_SSH_PRIVATE_KEY` 与 `SITE_SSH_KNOWN_HOSTS` 登录既有服务器；打包后的站点放在 `/var/www/taoqi-pet/releases/<commit>`，原子切换 `current` 符号链接。独立的 `pet.ganzhibin.icu` Nginx 虚拟主机提供静态文件，Certbot 使用 webroot 申请 HTTPS 证书。部署后验证首页包含“淘气桌宠”，并下载 `penguin-idle.gif` 检查 GIF89a 文件头。工作流不依赖其他项目仓库或其密钥。

## 图标完整性校验

`package.json` 明确指定 macOS 应用与 DMG 的 ICNS、Windows 应用与 NSIS 安装程序的 ICO。`scripts/check-app-icons.js` 在 `npm run check` 中验证 ICNS 头部总长度和图像块边界，并验证 ICO 图像索引；若仓库中的二进制资源被截断，CI 和发布构建会在打包前失败。此校验针对应用资源文件，不代替 Windows/macOS 实机图标验收，也不决定官网的角色定位。
