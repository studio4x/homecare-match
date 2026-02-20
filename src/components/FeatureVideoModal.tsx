"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { X } from 'lucide-react';
import LandingVideoPlayer from "./LandingVideoPlayer";

interface FeatureVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  video: { url: string; title: string; type: 'url' | 'storage' } | null;
}

const FeatureVideoModal = ({ open, onOpenChange, video }: FeatureVideoModalProps) => {
  if (!video) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-none">
        <DialogHeader className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/70 to-transparent">
          <DialogTitle className="text-white text-lg flex items-center justify-between">
            {video.title}
            <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Vídeo demonstrativo da funcionalidade {video.title}.
          </DialogDescription>
        </DialogHeader>
        <AspectRatio ratio={16/9}>
          <LandingVideoPlayer 
            url={video.url} 
            title={video.title} 
            className="border-none"
            autoplay={false} // Desativar autoplay
          />
        </AspectRatio>
      </DialogContent>
    </Dialog>
  );
};

export default FeatureVideoModal;