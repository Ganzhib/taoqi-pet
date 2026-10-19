# 内置角色精简与企鹅默认角色 · 技术设计

> 后续变更：咕咕嘎嘎动态桌宠加入后，默认角色已改为 `gugugaga-idle`，内置目录增至 8 位；最新架构见 [`../gugugaga-pet/architecture.md`](../gugugaga-pet/architecture.md)。本文件保留当时的精简与迁移设计。

对应需求：`requirements.md`。

## 角色目录

`src/electron/pet-core.js` 的 `CHARACTERS` 是市场、托盘“快速切换角色”和内置素材白名单的共同来源。目录调整为：企鹅、发呆猫、小奶猫、打工狗、泡泡龙、蹦蹦兔、云朵团子。被下架的七个猫咪状态从该数组和 `src/ui/pet/reactions.ts` 移除，因此不再被应用选择或加载。

素材文件不随目录删除。`site/` 使用 7 位当前内置角色的 `*-idle.gif` 展示可切换阵容，并把橘白猫作为普通选项之一；历史猫咪状态素材仍保留在 `assets/pets/`，但不再决定官网定位。

## 默认值与迁移

`DEFAULT_CHARACTER_ID` 在 `pet-core.js` 中定义为 `penguin-idle`，供角色目录测试和设置存储共用。`resolveCharacterId(characterId, customPets)` 是纯函数：当已保存 id 属于当前内置目录或有效自定义宠物时原样返回，否则返回企鹅。

`settings-store.js` 在读取并校验自定义宠物之后调用该函数。因此新安装、损坏设置、已下架猫咪状态和已不存在的自定义宠物都会回退到企鹅；仍存在的自定义宠物不受影响。删除当前自定义宠物时继续使用 `DEFAULT_SETTINGS.characterId`，自然回到企鹅。

## 验证

`tests/pet-core.test.js` 锁定默认 id、唯一 `cat-` 角色和旧 id 迁移行为。`tests/electron-smoke.js` 使用隔离用户目录验证首次启动企鹅、市场 7 张卡片、发呆猫切换、透明 WebM 播放，以及删除自定义宠物后回到企鹅。

## 互动气泡定位

桌宠窗口会随 `scale` 增高，同时 `.pet` 继续围绕自身中心缩放；如果气泡固定在窗口顶部，较大尺寸下两者距离会明显增加。`PetApp.tsx` 根据宠物固定底边、基础高度和当前缩放比例计算气泡的 `bottom`，把气泡底边锚定在宠物缩放后的视觉顶边附近。专注计时存在时仍让顶部计时徽章优先，并沿用徽章下方的气泡位置，避免两个提示互相遮挡。冒烟测试通过两者的实际边界矩形限制普通互动时的间距。
