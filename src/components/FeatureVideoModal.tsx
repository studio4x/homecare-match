"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { X } from "lucide-react";
import LandingVideoPlayer from "./LandingVideoPlayer";

interface FeatureVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  video: { url: string; title: string; type: "url" | "storage" } | null;
}

const FeatureVideoModal = ({ open, onOpenChange, video }: FeatureVideoModalProps) => {
  const [isLandscapeFullscreen, setIsLandscapeFullscreen] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsLandscapeFullscreen(false);
      return;
    }

    const updateLayout = () => {
      if (typeof window === "undefined") return;
      const isMobile = window.innerWidth <= 1024;
      const isLandscape = window.innerWidth > window.innerHeight;
      setIsLandscapeFullscreen(isMobile && isLandscape);
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    window.addEventListener("orientationchange", updateLayout);

    return () => {
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("orientationchange", updateLayout);
    };
  }, [open]);

  const contentClassName = useMemo(
    () =>
      isLandscapeFullscreen
        ? "p-0 overflow-hidden bg-black border-none [&>button]:hidden !top-0 !left-0 !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 rounded-none"
        : "max-w-4xl p-0 overflow-hidden bg-black border-none [&>button]:hidden",
    [isLandscapeFullscreen],
  );

  if (!video) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentClassName}>
        <h2 className="sr-only">{video.title}</h2>
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-20 p-1.5 rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
          style={isLandscapeFullscreen ? { top: "max(12px, env(safe-area-inset-top))" } : undefined}
          aria-label="Fechar video"
        >
          <X className="h-5 w-5" />
        </button>
        {isLandscapeFullscreen ? (
          <div className="h-full w-full">
            <LandingVideoPlayer
              url={video.url}
              title={video.title}
              className="h-full w-full border-none"
              autoplay={false}
              showTitleOverlay={false}
            />
          </div>
        ) : (
          <AspectRatio ratio={16 / 9}>
            <LandingVideoPlayer
              url={video.url}
              title={video.title}
              className="border-none"
              autoplay={false}
              showTitleOverlay={false}
            />
          </AspectRatio>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FeatureVideoModal;
