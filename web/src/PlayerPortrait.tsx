import { useState } from "react";

const placeholder = "/ppg-silhouette.png";

export function PlayerPortrait({ src, className = "" }: { src?: string | null; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const hasPhoto = Boolean(src && src !== failedSrc);
  return <img className={`player-portrait ${hasPhoto ? "player-portrait--photo" : "player-portrait--placeholder"} ${className}`}
    src={hasPhoto ? src! : placeholder} width={160} height={160} alt="" aria-hidden="true" loading="lazy"
    onError={() => { if (src && src !== failedSrc) setFailedSrc(src); }} />;
}
