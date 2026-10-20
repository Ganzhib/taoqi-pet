import { useEffect, useState } from "react";

type ArtworkLoader<T> = (id: string) => Promise<T | null>;

// 加载桌宠素材。T 可以是 data URL 字符串，也可以是 ArtworkSource 描述。
export function useArtwork<T>(characterId: string | null, loadArtwork: ArtworkLoader<T>) {
  const [loaded, setLoaded] = useState<{ id: string; artwork: T | null } | null>(null);

  useEffect(() => {
    if (characterId === null) return;
    let active = true;
    loadArtwork(characterId).then((artwork) => {
      if (active) setLoaded({ id: characterId, artwork });
    });
    return () => { active = false; };
  }, [characterId, loadArtwork]);

  // 角色切换后的第一次渲染发生在新素材加载完成之前。此时立即卸载旧素材，
  // 避免透明视频层继续合成上一套造型的最后一帧。
  return loaded?.id === characterId ? loaded.artwork : null;
}
