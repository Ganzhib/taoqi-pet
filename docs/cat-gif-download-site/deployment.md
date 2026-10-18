# 下载官网部署

官网源码在 `site/`，八个动图在 `assets/pets/`。发布流程完整保存在本仓库的 [Deploy download website](https://github.com/Ganzhib/taoqi-pet/blob/main/.github/workflows/deploy-site.yml) 工作流中，目标是现有服务器 `150.158.27.165` 和域名 `pet.ganzhibin.icu`。

## 一次性配置

使用**仅供淘气桌宠官网部署**的 SSH 密钥。请在你的设备上生成密钥对，把公钥添加到服务器 root 账号的 `~/.ssh/authorized_keys`，把私钥全文保存为本仓库 GitHub Environment `production` 的 Secret `SITE_SSH_PRIVATE_KEY`。将服务器已验证的 SSH 主机公钥行保存为同一环境的 Secret `SITE_SSH_KNOWN_HOSTS`。不要把私钥发到聊天或提交进仓库。

工作流要求该密钥能以 root 登录当前服务器，因为首次部署需要创建独立 Nginx 虚拟主机和申请证书。它只管理 `/var/www/taoqi-pet` 与 `/etc/nginx/sites-available/pet.ganzhibin.icu`，不覆盖其他站点的文件。DNS 的 `pet` A 记录应指向 `150.158.27.165`。

## 发布与验收

在本仓库 Actions 页面手动运行 **Deploy download website**。工作流将页面、八个 GIF 和图标压缩上传，创建按 Git commit 命名的发布目录，再把 `current` 链接原子指向新版本。之后验证 Nginx 配置、申请或复用 Let's Encrypt 证书、检查 HTTPS 页面与 GIF89a 文件。服务器跨境上传较慢，工作流给上传步骤留了 20 分钟。

桌面安装包由 [Publish unsigned preview](https://github.com/Ganzhib/taoqi-pet/blob/main/.github/workflows/release-preview.yml) 独立生成。官网上的下载链接需要与对应 Release 资产名称保持一致。
