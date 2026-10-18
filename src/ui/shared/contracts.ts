export type PetAction = "feed" | "play" | "praise";
export type PetReaction = PetAction | "tap" | "double" | "long" | "nap";

export interface PetState {
  roaming: boolean;
  quietMode: boolean;
  alwaysOnTop: boolean;
  scale: number;
  characterId: string;
  decorationId: string;
  focusEndsAt: number | null;
  focusActive: boolean;
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
  getArtwork(id: string): Promise<string | null>;
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
  importPet(): Promise<string | null>;
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
