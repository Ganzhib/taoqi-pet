# 下载官网部署

官网源码在 `site/`，8 位内置伙伴的待机动图在 `assets/pets/*-idle.gif`，咕咕嘎嘎品牌头像在 `assets/brand/gugugaga-avatar.png`。

官网只通过 [GitHub Pages](https://ganzhib.github.io/taoqi-pet/) 发布，由本仓库的 [Publish download site to GitHub Pages](https://github.com/Ganzhib/taoqi-pet/blob/main/.github/workflows/deploy-pages.yml) 工作流负责，不需要 SSH 密钥、独立服务器、Nginx 或域名证书配置。

推送 `site/**`、`assets/pets/**`、`assets/brand/**` 或 Pages 工作流自身的改动到 `main` 后会自动发布；也可以在 Actions 页面手动运行该工作流。构建会复制页面、8 个待机 GIF 与品牌头像，并在部署前验证素材数量。

下载链接不需要随每个版本手工改动：页面会读取 GitHub 最新正式 Release，并在四个必需安装包齐全后整体切换；若 GitHub API 暂时不可用，则继续使用 HTML 内置的上一个稳定版本链接。

桌面安装包由 [Publish unsigned preview](https://github.com/Ganzhib/taoqi-pet/blob/main/.github/workflows/release-preview.yml) 独立生成。官网上的下载链接需要与对应 Release 资产名称保持一致。
