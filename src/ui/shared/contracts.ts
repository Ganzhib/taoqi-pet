export type PetAction = "feed" | "play" | "praise";
export type PetReaction = PetAction | "tap" | "double" | "long" | "nap" |
  "look" | "waddle" | "slide";

export interface GugugagaStateOption {
  id: string;
  name: string;
}

export interface PetState {
  roaming: boolean;
  movementMode: "stay" | "wander" | "follow";
  quietMode: boolean;
  alwaysOnTop: boolean;
  scale: number;
  characterId: string;
  gugugagaStateId: string;
  gugugagaStates: GugugagaStateOption[];
  decorationId: string;
  focusEndsAt: number | null;
  focusActive: boolean;
}

export interface GeneratedPetOptions {
  name: string;
  shape: "cat" | "dragon" | "bean";
  color: string;
  eyes: "round" | "sleepy" | "sparkle";
}

export interface CatalogPet {
  id: string;
  name: string;
  category: string;
  description: string;
  source: "built-in" | "custom";
}

export interface PetCatalog {
  selectedId: string;
  pets: CatalogPet[];
}

export type ArtworkKind = "gif" | "video" | "image";

// 素材描述。渲染层只按 kind 选渲染方式，不关心文件后缀，
// 这样换素材格式时渲染代码不用跟着改。
export interface ArtworkSource {
  id: string;
  kind: ArtworkKind;
  mime: string;
  url: string;
  // 内置动画才有（管线约定值）；自定义图片为 null
  frameCount: number | null;
  frameDelayMs: number | null;
}

export interface HomeState {
  characterId: string;
  characterName: string;
  decorationId: string;
  themeId: string;
  furnitureId: string;
  bestCatch: number;
}

interface PetBridge {
  getState(): Promise<PetState>;
  // 主素材，内置角色是透明 WebM
  getArtworkSource(id: string): Promise<ArtworkSource | null>;
  // 图片素材（GIF），供 <img> 使用与视频解码失败时降级
  getArtwork(id: string): Promise<string | null>;
  setGugugagaState(id: string): Promise<boolean>;
  showMenu(): void;
  openMarket(): void;
  openHome(): void;
  dragStart(): void;
  dragMove(): void;
  dragEnd(): void;
  onState(callback: (state: PetState) => void): () => void;
  onMotion(callback: (motion: "idle" | "walk") => void): () => void;
  onAction(callback: (action: PetAction) => void): () => void;
  onNotice(callback: (message: string) => void): () => void;
}

interface MarketBridge {
  getCatalog(): Promise<PetCatalog>;
  getArtwork(id: string): Promise<string | null>;
  select(id: string): Promise<boolean>;
  importPet(): Promise<{ id: string; cutout: boolean; animated: boolean } | null>;
  previewGenerated(options: GeneratedPetOptions): Promise<string>;
  createGenerated(options: GeneratedPetOptions): Promise<string>;
  removePet(id: string): Promise<boolean>;
  renamePet(id: string, name: string): Promise<boolean>;
  onCatalog(callback: (catalog: PetCatalog) => void): () => void;
}

interface HomeBridge {
  getState(): Promise<HomeState>;
  getArtwork(id: string): Promise<string | null>;
  setTheme(id: string): Promise<boolean>;
  setFurniture(id: string): Promise<boolean>;
  saveScore(score: number): Promise<number>;
  onState(callback: (state: HomeState) => void): () => void;
}

declare global {
  interface Window {
    taoqiPet: PetBridge;
    petMarket: MarketBridge;
    taoqiHome: HomeBridge;
  }
}
