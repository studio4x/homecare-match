"use client";

import { cn } from "@/lib/utils";
import { getYouTubeEmbedUrl } from "@/lib/video-utils";

interface LandingVideoPlayerProps {
  url: string;
  title?: string;
  className?: string;
  autoplay?: boolean; // Adicionando prop autoplay
}

const LandingVideoPlayer = ({ url, title, className, autoplay = false }: LandingVideoPlayerProps) => {
  const isYouTubeUrl = url && (url.includes("youtube.com") || url.includes("youtu.be"));
  const processedUrl = isYouTubeUrl ? getYouTubeEmbedUrl(url) : url;
  const isEmbeddedVideo = isYouTubeUrl || processedUrl.includes("vimeo.com/video");

  // Adiciona autoplay=1 apenas se a prop autoplay for verdadeira
  const youtubeEmbedUrl = isYouTubeUrl ? getYouTubeEmbedUrl(url, autoplay) : processedUrl;

  return (
    <div className={cn("relative w-full h-full overflow-hidden bg-black shadow-2xl border border-border/50", className)}>
      {isEmbeddedVideo ? (
        <iframe
          src={youtubeEmbedUrl}
          title={title || "Vídeo"}
          className="absolute inset-0 w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video
          src={processedUrl}
          className="w-full h-full object-contain"
          controls
          playsInline
          autoPlay={autoplay} // Usando a prop autoplay aqui
          muted={autoplay} // Muta se for autoplay para melhor UX
        />
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