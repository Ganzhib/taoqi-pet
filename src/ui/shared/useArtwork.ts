import { useEffect, useState } from "react";

type ArtworkLoader<T> = (id: string) => Promise<T | null>;

// 加载桌宠素材。T 可以是 data URL 字符串，也可以是 ArtworkSource 描述。
export function useArtwork<T>(characterId: string | null, loadArtwork: ArtworkLoader<T>) {
  const [artwork, setArtwork] = useState<T | null>(null);

  useEffect(() => {
    if (characterId === null) return;
    let active = true;
    loadArtwork(characterId).then((source) => {
      if (active) setArtwork(source);
    });
    return () => { active = false; };
  }, [characterId, loadArtwork]);

  return artwork;
}
