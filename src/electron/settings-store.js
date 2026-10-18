const { app } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { CHARACTERS, DECORATIONS, HOME_THEMES, HOME_FURNITURE, isValidCustomPet } = require("./pet-core");

const DEFAULT_SETTINGS = {
  roaming: true,
  quietMode: false,
  alwaysOnTop: true,
  scale: 1,
  characterId: "cat-idle",
  decorationId: "none",
  customPets: [],
  homeThemeId: "sunny",
  homeFurnitureId: "cushion",
  bestCatch: 0,
  position: null,
  focusEndsAt: null,
};
const FOCUS_DURATION_MS = 25 * 60 * 1000;
function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function customPetPath(pet) {
  return path.join(app.getPath("userData"), "pets", pet.id + "." + pet.extension);
}

function readSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
    const customPets = (Array.isArray(saved.customPets) ? saved.customPets : [])
      .filter(isValidCustomPet)
      .map((pet) => ({ id: pet.id, name: pet.name.trim().slice(0, 32), extension: pet.extension,
        ...(pet.kind === "generated" ? { kind: "generated" } : {}) }))
      .filter((pet) => fs.existsSync(customPetPath(pet)));
    const now = Date.now();
    return {
      roaming: saved.roaming !== false,
      quietMode: saved.quietMode === true,
      alwaysOnTop: saved.alwaysOnTop !== false,
      scale: [1, 1.25, 1.5].includes(saved.scale) ? saved.scale : 1,
      characterId: [...CHARACTERS, ...customPets].some((character) => character.id === saved.characterId)
        ? saved.characterId : DEFAULT_SETTINGS.characterId,
      customPets,
      decorationId: DECORATIONS.some((decoration) => decoration.id === saved.decorationId)
        ? saved.decorationId : DEFAULT_SETTINGS.decorationId,
      homeThemeId: HOME_THEMES.some((theme) => theme.id === saved.homeThemeId)
        ? saved.homeThemeId : DEFAULT_SETTINGS.homeThemeId,
      homeFurnitureId: HOME_FURNITURE.some((furniture) => furniture.id === saved.homeFurnitureId)
        ? saved.homeFurnitureId : DEFAULT_SETTINGS.homeFurnitureId,
      bestCatch: Number.isInteger(saved.bestCatch) && saved.bestCatch >= 0
        ? saved.bestCatch : DEFAULT_SETTINGS.bestCatch,
      position: saved.position && Number.isFinite(saved.position.x) && Number.isFinite(saved.position.y)
        ? { x: Math.round(saved.position.x), y: Math.round(saved.position.y) } : null,
      focusEndsAt: Number.isFinite(saved.focusEndsAt) &&
        saved.focusEndsAt > now && saved.focusEndsAt <= now + FOCUS_DURATION_MS
        ? saved.focusEndsAt : null,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
}

module.exports = { DEFAULT_SETTINGS, FOCUS_DURATION_MS, customPetPath, readSettings, saveSettings };
