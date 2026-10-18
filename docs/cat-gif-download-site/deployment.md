# 下载官网部署

页面源码位于 `site/`，所需动图在 `assets/pets/`。正式部署使用 [catbuddy 的独立 GitHub Actions 工作流](https://github.com/Ganzhib/catbuddy/blob/master/.github/workflows/deploy-taoqi-pet-site.yml)，直接检出 `Ganzhib/taoqi-pet/main`，将站点复制到服务器 `/var/www/taoqi-pet`。

## 服务器边界

- 域名：`pet.ganzhibin.icu`，A 记录指向 `150.158.27.165`。
- 仅写入该站专属的 Nginx 配置和静态目录；不改动简历站与 CatBuddy 站。
- SSH 密钥由 `Ganzhib/catbuddy` 的 `production` 环境 Secret `DEPLOY_SSH_KEY` 注入；仓库里不存储私钥。
- 证书通过服务器 Certbot 的 webroot 模式申请。HTTPS 配置通过 `nginx -t` 后才重载 Nginx。

## 更新与验证

修改 `taoqi-pet` 后，在 `Ganzhib/catbuddy` 的 Actions 页面手动运行 **Deploy Taoqi Pet download site**。首次增加工作流时也会自动运行一次。验收包括官网 HTML、八个 GIF 的资源路径、证书域名和 Windows/macOS Release 下载链接。服务器部署与桌面预览版打包是两条独立流程。
