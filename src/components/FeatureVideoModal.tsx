"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { X } from 'lucide-react';
import { getYouTubeEmbedUrl } from "@/lib/video-utils"; // Import the new utility

interface FeatureVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  video: { url: string; title: string; type: 'url' | 'storage' } | null;
}

const FeatureVideoModal = ({ open, onOpenChange, video }: FeatureVideoModalProps) => {
  if (!video) return null;

  // Processa a URL imediatamente para garantir que seja a URL de incorporação do YouTube, se aplicável.
  const processedVideoUrl = getYouTubeEmbedUrl(video.url);
  
  // Agora verifica se é um vídeo incorporável (YouTube embed ou Vimeo) usando a URL já processada.
  const isEmbeddedVideo = processedVideoUrl.includes("youtube.com/embed") || processedVideoUrl.includes("vimeo.com/video");

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
        </DialogHeader>
        <AspectRatio ratio={16/9}>
          {isEmbeddedVideo ? (
            <iframe
              src={processedVideoUrl} // Usa a URL processada aqui
              title={video.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              src={processedVideoUrl} // Também usa a URL processada para vídeos não incorporados, por consistência
              className="h-full w-full object-contain"
              controls
              autoPlay
            />
          )}
        </AspectRatio>
      </DialogContent>
    </Dialog>
  );
};

export default FeatureVideoModal;