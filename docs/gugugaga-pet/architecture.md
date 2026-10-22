# 咕咕嘎嘎动态桌宠技术架构

## 1. 素材链路

```text
人物与动作参考图
  → 九张身份/服装全身母版（透明背景）
  → 九张 3×3 身份保真逐帧动作表（透明背景）
  → assets/source/gugugaga*-reference.png / *-spritesheet.png
  → scripts/render-gugugaga-gifs.py
  → scripts/render-pet-from-image.py
  ├─ assets/pets/gugugaga-*.webm  透明 VP9 主素材
  └─ assets/pets/gugugaga-*.gif   市场缩略图与降级素材
```

生成脚本把每张 3×3 动作表切成 9 个姿势帧；每格独立清理主体外彩色残影，再用整套动作的最大轮廓计算统一缩放比例和脚底基线，避免每帧被强行缩放成相同外接框。最终生成 280×320、95 ms/帧的循环 GIF 与透明 VP9 WebM。普通单图角色仍可走既有背景估色抠图与呼吸动画分支。

## 2. 运行时接入

- `src/electron/pet-core.js` 把 `gugugaga-idle` 注册为默认角色，并以有序元数据登记九种造型名称和素材 id；八个变体不单独占市场卡片。
- `src/electron/settings-store.js` 使用 `gugugagaStateId` 作为造型选择的唯一持久化字段，无效旧值迁移回书包默认造型。
- `src/electron/main.js` 验证造型 id 后通过专用 IPC 更新设置；`src/electron/preloads/pet.js` 只暴露页面需要的造型切换方法。
- `src/electron/animation/artwork-source.js` 按通用约定优先解析 WebM，并提供 GIF 降级。
- `src/ui/shared/ArtworkPlayer.tsx` 保持统一视频/图片渲染，不增加角色特例。
- `src/ui/pet/PetApp.tsx` 在角色脚下渲染悬浮胶囊工具条：衣服按钮展开九宫格，轮换按钮选择下一个造型；播放器只根据持久化造型 id 选素材，互动状态只驱动 CSS 肢体反馈。定时器仍由现有单一空闲调度器持有并清理。
- `src/ui/pet/pet.css` 统一控制所有桌宠的透明窗口合成。角色与素材不叠加轮廓 `drop-shadow`：它在白色壁纸上会形成灰紫色残影，键盘焦点改用独立的小圆点提示；专注模式只降低饱和度。修复边缘问题时先分别检查源帧与窗口截图，避免把样式效果误判成素材缺陷。
- `src/ui/pet/reactions.ts` 提供角色专属文本。

## 3. 动画组合

每种可选造型直接播放有肢体关节变化的逐帧表；窗口位移仍由现有运动系统负责，不能改写造型：

| 造型 | 视觉动作 |
| --- | --- |
| 待机 | 书包造型，抬臂挥手并回到拉衣角姿势 |
| 黑帽·走路 | 黑色针织帽造型，双腿交替抬起、双臂反向摆动 |
| 托腮·晃脚 | 托腮坐姿，转头眨眼并轻抬一只脚 |
| 背带裤·蹦跳 | 背带裤造型，屈膝、抬腿、张臂并拍手 |
| 红帽·大笑 | 红帽造型，屈膝握拳、仰头大笑再站直 |
| 猫耳·猫爪 | 猫耳滤镜造型，抬起双手做猫爪、蹲下并跳起 |
| 小工人·喝饮料 | 黄色小工人造型，举杯吸饮、放下后竖起拇指 |
| 双手合十·鞠躬 | 双手合十造型，抬手、弯膝鞠躬再抬头 |
| 云朵睡衣·伸懒腰 | 云朵睡衣造型，揉眼、举臂伸懒腰和打哈欠 |

`prefers-reduced-motion` 下停用 CSS 动画；安静模式下停止无交互待机变换，自主行为继续受现有暂停、专注和页面可见性条件约束。

## 4. 测试

- 核心测试验证角色元数据及动画文件存在。
- 素材解析测试自动遍历所有内置角色，验证 WebM 主源和 GIF 降级源。
- Electron smoke test 将市场卡片数量更新为 8，并继续验证实际角色切换后的媒体播放。
- Electron smoke test 验证点击角色不换装、胶囊工具条可选造型，并检查选择已写入隔离的本地设置。
- Electron smoke test 验证聚焦后素材和宠物容器均无轮廓滤镜，并保留可见的键盘焦点提示；白底截图用于人工核对边缘。

## 5. 品牌图标链路

`assets/brand/gugugaga-avatar.png` 保存透明头肩头像。`scripts/render-brand-icons.py` 在暖米色圆角底板上合成头像，并同时输出：

- `assets/icon.png`：Electron 窗口、通知与托盘运行时图标；
- `build/icon.png`：构建检查与预览；
- `build/icon.ico`：Windows 应用与安装包图标；
- `build/icon.icns`：macOS 应用图标。

下载官网使用同一透明头像母版作为导航品牌标记，并以咕咕嘎嘎待机动图作为首屏默认预览。
