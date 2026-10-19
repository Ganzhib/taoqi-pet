# 企鹅动作与陪伴模式 · 技术设计

对应需求：`requirements.md`。

## 设置与迁移

`settings-store.js` 新增 `movementMode`，合法值由 `pet-core.js` 的 `MOVEMENT_MODES` 统一定义。读取旧设置时，`resolveMovementMode()` 将 `roaming: false` 映射为 `stay`，其他情况映射为 `wander`；运行期继续保留派生的 `roaming` 字段，兼容现有渲染层契约。

菜单用同一个模式列表生成单选项。切换模式时同时更新 `movementMode` 和派生的 `roaming`，仍由 `settings-store.js` 作为唯一持久化入口。

## 窗口运动

主进程继续单独拥有窗口位置和移动计时器：

- `stay`：不创建窗口移动计时器。
- `wander`：沿用现有 14–26 秒后短距离横向散步。
- `follow`：每 90ms 读取一次 `screen.getCursorScreenPoint()`，通过纯函数 `nextFollowBounds()` 向光标移动最多 8px；进入 90px 停止半径后保持原位。

三种模式共用 `scheduleWalk()`、`stopWalk()` 和同一个 interval 所有权。拖拽开始、隐藏、安静模式、专注和退出都沿用既有清理路径，避免叠加计时器。目标位置经 `clampToWorkArea()` 限制，不会追出屏幕工作区。

## 企鹅局部动作

渲染层在既有 `PetReaction` 状态上增加 `look`、`waddle`、`slide`。企鹅的单一待机 WebM 保持不变，动作由 CSS 对透明素材整体做短时旋转、平移和压缩，因此不增加运行时解码器或外部素材。喂鱼、开心和睡眠效果由 `.pet::after` 生成，仅作为无障碍隐藏的装饰，不改变交互命中区域。

`PetApp.tsx` 仍只有一个自主行为 timer。企鹅在 18–36 秒之间从低干扰动作池抽取一次，其他角色保持原节奏；窗口正在移动时仅重排下一次动作。自动动作不弹气泡，避免持续打断用户，主动点击与菜单互动仍显示文案。企鹅的单击反馈按点击次数在张望、摇摆和轻跳之间轮换，双击继续使用更强的兴奋反馈。

## 隐私与辅助功能

跟随模式只使用光标屏幕坐标，不截屏、不读取窗口标题或内容，也不监听全局键盘。新增关键帧和伪元素统一在 `prefers-reduced-motion: reduce` 下关闭。
