import { useState } from "react";
import type { ArtworkSource } from "./contracts";

type ArtworkPlayerProps = {
  source: ArtworkSource | null;
  className?: string;
  // 变化时重启一次动画，用于点击反馈这类一次性动作
  playKey?: number | string;
  // 视频解码失败时回退到动图源（GIF / 静态图）
  loadFallback?: (id: string) => Promise<string | null>;
};

// 桌宠动画的唯一渲染出口。
//
// 内置素材优先走带 8 bit alpha 的透明 WebM（<video>），解码失败自动退回
// GIF（<img>）。渲染层只认 source.kind，不认文件后缀。
export function ArtworkPlayer({
  source,
  className = "pet-art",
  playKey,
  loadFallback,
}: ArtworkPlayerProps) {
  // 记录解码失败的视频地址：换角色后地址变了，就会重新尝试视频
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);

  if (source !== null && source.kind === "video" && failedUrl !== source.url) {
    const current = source;
    return (
      <video
        id="pet-art"
        key={playKey}
        className={className}
        src={current.url}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onError={() => {
          setFailedUrl(current.url);
          if (loadFallback) {
            loadFallback(current.id).then((url) => {
              if (url) setFallback(url);
            });
          }
        }}
      />
    );
  }

  const failed = source !== null && failedUrl === source.url;
  const src = failed ? fallback : source?.url;

  return (
    <img
      id="pet-art"
      className={className}
      key={playKey}
      src={src ?? undefined}
      alt=""
      draggable={false}
    />
  );
}
