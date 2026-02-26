"use client";

import React from "react";
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
  if (!video) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-none">
        <h2 className="sr-only">{video.title}</h2>
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-20 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          aria-label="Fechar video"
        >
          <X className="h-5 w-5" />
        </button>
        <AspectRatio ratio={16 / 9}>
          <LandingVideoPlayer
            url={video.url}
            title={video.title}
            className="border-none"
            autoplay={false}
            showTitleOverlay={false}
          />
        </AspectRatio>
      </DialogContent>
    </Dialog>
  );
};

export default FeatureVideoModal;
