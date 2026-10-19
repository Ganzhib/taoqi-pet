import type { ArtworkSource } from "./contracts";

type ArtworkPlayerProps = {
  source: ArtworkSource | null;
  className?: string;
  // 变化时重启一次动画，用于点击反馈这类一次性动作
  playKey?: number | string;
};

// 桌宠动画的唯一渲染出口。
//
// 现在内置素材全部落在 "gif" 分支，行为与改造前一致。M2 生成透明 WebM 后，
// resolveArtworkSource 会返回 kind = "video"，这里自动改用 <video> 播放
// （透明由 VP9 alpha 通道提供），组件外的代码不需要改动。
export function ArtworkPlayer({ source, className = "pet-art", playKey }: ArtworkPlayerProps) {
  if (source && source.kind === "video") {
    return (
      <video
        id="pet-art"
        key={playKey}
        className={className}
        src={source.url}
        autoPlay
        loop
        muted
        playsInline
      />
    );
  }

  return (
    <img
      id="pet-art"
      className={className}
      key={playKey}
      src={source?.url}
      alt=""
      draggable={false}
    />
  );
}
