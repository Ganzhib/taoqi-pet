const TOOLBOX_URL = "https://next.ganzhibin.icu/?utm_source=taoqi_pet&utm_medium=app&utm_content=toolbox";

const CHARACTERS = [
  { id: "caramel", name: "焦糖猫" },
  { id: "night", name: "星夜猫" },
  { id: "mint", name: "薄荷猫" },
];

function clampToWorkArea(bounds, workArea) {
  const maxX = Math.max(workArea.x, workArea.x + workArea.width - bounds.width);
  const maxY = Math.max(workArea.y, workArea.y + workArea.height - bounds.height);
  return {
    ...bounds,
    x: Math.min(Math.max(bounds.x, workArea.x), maxX),
    y: Math.min(Math.max(bounds.y, workArea.y), maxY),
  };
}

module.exports = { TOOLBOX_URL, CHARACTERS, clampToWorkArea };
