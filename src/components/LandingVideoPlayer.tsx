"use client";

import { Play, Volume2, VolumeX } from "lucide-react";
import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { getYouTubeEmbedUrl } from "@/lib/video-utils"; // Import the new utility

interface LandingVideoPlayerProps {
  url: string;
  title?: string;
  className?: string;
}

const LandingVideoPlayer = ({ url, title, className }: LandingVideoPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Convert YouTube URL to embed format
  const processedUrl = getYouTubeEmbedUrl(url);
  const isEmbeddedVideo = processedUrl.includes("youtube.com/embed") || processedUrl.includes("vimeo.com/video");

  const togglePlay = () => {
    if (isEmbeddedVideo && iframeRef.current) {
      // For embedded videos, we can't directly control play/pause easily.
      // The autoplay=1 in the embed URL handles initial play.
      // For now, we'll just toggle the overlay.
      setIsPlaying(!isPlaying);
    } else if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className={cn("relative group rounded-3xl overflow-hidden bg-black shadow-2xl border border-border/50", className)}>
      {isEmbeddedVideo ? (
        <iframe
          ref={iframeRef}
          src={processedUrl}
          className="w-full h-full object-cover"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={() => setIsPlaying(true)} // Assume it starts playing on load
        />
      ) : (
        <video
          ref={videoRef}
          src={processedUrl}
          className="w-full h-full object-cover"
          loop
          muted={isMuted}
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      )}

      {/* Overlay de Controle */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-300",
        isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"
      )}>
        <button
          onClick={togglePlay}
          className="h-20 w-20 rounded-full bg-primary/90 text-white flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
        >
          {isPlaying ? (
            <div className="flex gap-1.5">
              <div className="w-2 h-8 bg-white rounded-full" />
              <div className="w-2 h-8 bg-white rounded-full" />
            </div>
          ) : (
            <Play className="h-10 w-10 fill-current ml-1" />
          )}
        </button>
      </div>

      {/* Botão de Mudo */}
      <button
        onClick={() => setIsMuted(!isMuted)}
        className="absolute bottom-6 right-6 p-3 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition-colors"
      >
        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>

      {/* Título/Badge */}
      {title && (
        <div className="absolute top-6 left-6">
          <span className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white text-xs font-bold uppercase tracking-widest border border-white/20">
            {title}
          </span>
        </div>
      )}
    </div>
  );
};

export default LandingVideoPlayer;