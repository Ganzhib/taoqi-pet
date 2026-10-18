import { useEffect, useState } from "react";

type ArtworkLoader = (id: string) => Promise<string | null>;

export function useArtwork(characterId: string | null, loadArtwork: ArtworkLoader) {
  const [artwork, setArtwork] = useState<string | null>(null);

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
