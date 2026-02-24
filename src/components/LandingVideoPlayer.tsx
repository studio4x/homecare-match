"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getYouTubeEmbedUrl } from "@/lib/video-utils";
import { PlayCircle } from "lucide-react";

interface LandingVideoPlayerProps {
  url: string;
  title?: string;
  className?: string;
  autoplay?: boolean; // Adicionando prop autoplay
  deferLoad?: boolean;
}

const LandingVideoPlayer = ({ url, title, className, autoplay = false, deferLoad = false }: LandingVideoPlayerProps) => {
  const isYouTubeUrl = url && (url.includes("youtube.com") || url.includes("youtu.be"));
  const processedUrl = isYouTubeUrl ? getYouTubeEmbedUrl(url) : url;
  const isEmbeddedVideo = isYouTubeUrl || processedUrl.includes("vimeo.com/video");
  const shouldDefer = deferLoad && !autoplay;
  const [isActivated, setIsActivated] = useState(!shouldDefer);

  useEffect(() => {
    setIsActivated(!shouldDefer);
  }, [url, shouldDefer]);

  // Adiciona autoplay=1 apenas se a prop autoplay for verdadeira
  const youtubeEmbedUrl = isYouTubeUrl ? getYouTubeEmbedUrl(url, autoplay) : processedUrl;

  return (
    <div className={cn("relative w-full h-full overflow-hidden bg-black shadow-2xl border border-border/50", className)}>
      {isActivated ? (
        isEmbeddedVideo ? (
        <iframe
          src={youtubeEmbedUrl}
          title={title || "Vídeo"}
          className="absolute inset-0 w-full h-full border-0"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video
          src={processedUrl}
          className="w-full h-full object-contain"
          controls
          preload="metadata"
          playsInline
          autoPlay={autoplay} // Usando a prop autoplay aqui
          muted={autoplay} // Muta se for autoplay para melhor UX
        />
      )
      ) : (
        <button
          type="button"
          onClick={() => setIsActivated(true)}
          className="absolute inset-0 flex items-center justify-center bg-black/70 text-white transition-opacity hover:bg-black/60"
          aria-label={title ? `Reproduzir ${title}` : "Reproduzir vídeo"}
        >
          <span className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium">
            <PlayCircle className="h-5 w-5" />
            Reproduzir vídeo
          </span>
        </button>
      )}

      {title && (
        <div className="absolute top-4 left-4 pointer-events-none z-10">
          <span className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider border border-white/10">
            {title}
          </span>
        </div>
      )}
    </div>
  );
};

export default LandingVideoPlayer;
