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

  let videoSrc = video.url;
  // Apply YouTube embed conversion if it's a YouTube URL
  if (videoSrc.includes("youtube.com") || videoSrc.includes("youtu.be")) {
    videoSrc = getYouTubeEmbedUrl(videoSrc);
  }

  const isEmbeddedVideo = videoSrc.includes("youtube.com/embed") || videoSrc.includes("vimeo.com/video");

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
              src={videoSrc}
              title={video.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              src={videoSrc}
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