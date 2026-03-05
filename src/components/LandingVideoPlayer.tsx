"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getYouTubeEmbedUrl, getYouTubeThumbnailUrl } from "@/lib/video-utils";
import { PlayCircle } from "lucide-react";

interface LandingVideoPlayerProps {
  url: string;
  title?: string;
  className?: string;
  autoplay?: boolean; // Adicionando prop autoplay
  deferLoad?: boolean;
  showTitleOverlay?: boolean;
  posterUrl?: string;
}

const LandingVideoPlayer = ({
  url,
  title,
  className,
  autoplay = false,
  deferLoad = false,
  showTitleOverlay = true,
  posterUrl,
}: LandingVideoPlayerProps) => {
  const isYouTubeUrl = url && (url.includes("youtube.com") || url.includes("youtu.be"));
  const processedUrl = isYouTubeUrl ? getYouTubeEmbedUrl(url) : url;
  const isEmbeddedVideo = isYouTubeUrl || processedUrl.includes("vimeo.com/video");
  const resolvedPosterUrl = String(posterUrl || "").trim() || (isYouTubeUrl ? getYouTubeThumbnailUrl(url) : "");
  const shouldDefer = deferLoad && !autoplay;
  const [isActivated, setIsActivated] = useState(!shouldDefer);
  const [playOnActivate, setPlayOnActivate] = useState(false);

  useEffect(() => {
    setIsActivated(!shouldDefer);
    setPlayOnActivate(false);
  }, [url, shouldDefer]);

  const effectiveAutoplay = autoplay || playOnActivate;
  const embeddedVideoUrl = (() => {
    if (isYouTubeUrl) return getYouTubeEmbedUrl(url, effectiveAutoplay);
    if (processedUrl.includes("vimeo.com/video") && effectiveAutoplay) {
      return `${processedUrl}${processedUrl.includes("?") ? "&" : "?"}autoplay=1`;
    }
    return processedUrl;
  })();

  return (
    <div className={cn("relative w-full h-full overflow-hidden bg-black shadow-2xl border border-border/50", className)}>
      {isActivated ? (
        isEmbeddedVideo ? (
        <iframe
          src={embeddedVideoUrl}
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
          autoPlay={effectiveAutoplay}
          muted={autoplay} // Muta se for autoplay para melhor UX
          poster={resolvedPosterUrl || undefined}
        />
      )
      ) : (
        <button
          type="button"
          onClick={() => {
            setPlayOnActivate(true);
            setIsActivated(true);
          }}
          className="group absolute inset-0 flex items-center justify-center bg-black/70 text-white transition-opacity hover:bg-black/60"
          style={
            resolvedPosterUrl
              ? {
                  backgroundImage: `url("${resolvedPosterUrl}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
          aria-label={title ? `Reproduzir ${title}` : "Reproduzir vídeo"}
        >
          {resolvedPosterUrl ? <span className="absolute inset-0 bg-black/55" /> : null}
          <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/75 to-transparent" />

          <span className="relative z-10 flex flex-col items-center gap-3">
            <span className="absolute -z-10 h-16 w-44 rounded-full bg-primary/40 blur-xl motion-safe:animate-pulse" />
            <span className="inline-flex items-center gap-3 rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-2xl ring-4 ring-white/30 transition-transform group-hover:scale-105 md:text-lg">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20">
                <PlayCircle className="h-5 w-5" />
              </span>
              Reproduzir vídeo
            </span>
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white/95 md:text-sm">
              Clique para assistir agora
            </span>
          </span>
        </button>
      )}

      {showTitleOverlay && title && (
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
