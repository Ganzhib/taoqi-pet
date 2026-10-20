# 自动更新技术架构

## 组件与数据流

- `src/electron/version-check.js`：从 Atom Feed 提取本项目版本标签，按项目版本格式比较版本，并生成候选 Release 的直接下载目录。
- `src/electron/update-manager.js`：负责检查调度、通知、菜单状态、平台分流和安装版的动态渠道选择。
- `src/electron/main.js`：创建更新管理器，提供托盘/右键菜单入口，安装前允许窗口退出。
- `electron-updater`：仅在已打包的 Windows NSIS 安装版调用。客户端先确定候选版本，再把 Generic Provider 指向该 Release 的下载目录，读取对应的 `latest.yml` 或 `preview.yml`，下载并校验安装包。
- GitHub Releases Atom Feed：公开版本发现源，不使用有匿名调用配额的 GitHub REST API。Feed 只包含已经公开的 Release；正式版忽略带 `-preview.N` 后缀的条目，预览版同时比较预览版和正式版。
- GitHub Release 下载目录：Windows 安装版的渠道清单与安装包来源；未签名 macOS 与 Windows 便携版只显示候选 Release 的下载入口。

## 生命周期

应用启动 15 秒后检查，随后每 6 小时检查。发现 Windows 更新后由 `electron-updater` 下载和校验构建产物；下载完成后才允许调用 `quitAndInstall`。常规退出时由更新器安装已下载版本。检查超时或失败不阻止桌宠离线运行，定时器在退出时清理。用户手动检查失败时可以直接打开官方发布页，避免版本服务暂时不可达时没有后续操作。

下载页和应用内菜单均指向官方 GitHub Release。应用不保存 GitHub Token，公开仓库的更新检查不要求登录。官网展示的版本号与 Release 资产名称由同一次发布同步更新。

## 发布流水线

`.github/workflows/release-preview.yml` 首先创建草稿 Release，再在 Windows 和 macOS runner 中用 `preview` 渠道构建并上传产物。发布任务确认 `preview.yml`、`preview-mac.yml` 及安装包存在后，才将草稿标记为公开预览版。预览版不生成或覆盖 `latest` 清单。

`.github/workflows/release.yml` 使用默认 `latest` 渠道构建正式版，只发布 `latest.yml` 与 `latest-mac.yml`。客户端根据 Atom Feed 选出候选版本后直接读取该 Release 的渠道清单，因此正式与预览发布互不覆盖。macOS 更新清单为将来完成签名后启用原地更新预留，当前客户端不会安装未签名更新。

每次版本升级先修改 `package.json` 和发布说明，执行 CI，再手动运行发布工作流；发布成功后把 `site/index.html` 下载链接与 README 更新到新版本。未签名版继续明确提示系统安全警告。

## 验证边界

纯函数测试覆盖版本顺序、无效标签、Atom Feed 解析、下载目录生成和渠道隔离，特别验证正式版不会选择 preview Release。CI 覆盖主进程语法、React 类型与现有 Electron 操作流程。构建后检查 Release 中的安装包和对应渠道清单，再分别用正式版与预览版 Windows 安装包验证下一次版本的下载、重启与数据保留；macOS 只验证通知和下载入口。
