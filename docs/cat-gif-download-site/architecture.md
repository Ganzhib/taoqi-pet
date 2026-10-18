# 橘白猫动图与下载官网：技术设计

## 素材与桌宠

`assets/source/catbuddy-reference.png` 保存所有者提供的原始透明图。可重复运行的 `scripts/render-cat-gifs.py` 用 Pillow 输出八个 280×320、12 帧循环 GIF，以及 PNG、ICO、ICNS 图标。以原图为唯一猫身，不重新生成肢体；学习用品、电脑、咖啡等道具由程序画在独立图层，每帧调整位置。GIF 使用透明色索引；测试检查 GIF89a 与多个帧控制块。

`pet-core.js` 保存八个状态元数据，`main.js` 只按受控内置 ID 读取 `assets/pets/<id>.gif` 并返回 `image/gif` 数据 URL；用户上传仍接受原有 PNG/JPG/GIF/WebP，生成角色仍保留 SVG。旧设置中的角色 ID 若已下架，由设置存储迁移到默认的 `cat-idle`。

置顶操作由主进程单一函数负责：Windows/macOS 设定高窗口层级，macOS 追加所有空间和全屏可见选项。菜单切换和首次窗口创建共用该函数；窗口隐藏、显示和退出保持原有生命周期。

## 内置工具窗口

“我的工具”菜单创建独立 BrowserWindow，按用户操作加载 https://next.ganzhibin.icu/ 。窗口关闭后销毁，再次点击时重新创建；重复点击则聚焦现有窗口。独立持久会话保留工具铺登录状态，禁用 Node 集成并开启沙箱。工具铺站内导航保持在 Electron 内，外部 HTTP(S) 与邮件链接交给系统默认应用。桌宠启动时不自动请求工具铺。

## 官网与发布

`site/` 只有 HTML/CSS/JS；页面不请求自有服务。构建步骤把文件和 `assets/pets/*.gif`、图标复制到静态发布目录。下载按钮固定指向当前预览版 GitHub Release 资产。页面支持键盘操作、响应式布局及减少动态效果偏好。

GitHub Actions 在 Windows/macOS 构建未签名安装包并发布 Release。部署工作流位于 `Ganzhib/catbuddy` 仓库，使用已有的 `production` 环境 root SSH 凭据 `DEPLOY_SSH_KEY`。它检出本仓库的 `main`，复制静态页面、八个 GIF 与图标到独立目录 `/var/www/taoqi-pet`，为 `pet.ganzhibin.icu` 写单独的 Nginx 虚拟主机并通过 Let's Encrypt 申请证书。`Ganzhib/resume` 的部署密钥只能以非 root 账号登录，没有修改 Nginx 的权限，因此没有继续用于官网部署。SSH 私钥只留在 GitHub Secret，绝不写入仓库或页面。
