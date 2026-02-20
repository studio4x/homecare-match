"use client";

import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { getYouTubeEmbedUrl } from "@/lib/video-utils";

interface LandingVideoPlayerProps {
  url: string;
  title?: string;
  className?: string;
}

const LandingVideoPlayer = ({ url, title, className }: LandingVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null); // For YouTube embeds
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(0.5); // Default volume
  const [progress, setProgress] = useState(0); // 0-100%
  const [duration, setDuration] = useState(0); // in seconds
  const [currentTime, setCurrentTime] = useState(0); // in seconds

  // Determine if it's a YouTube URL or a direct video file
  const isYouTubeUrl = url && (url.includes("youtube.com") || url.includes("youtu.be"));
  const processedUrl = isYouTubeUrl ? getYouTubeEmbedUrl(url) : url;
  const isEmbeddedVideo = isYouTubeUrl || processedUrl.includes("vimeo.com/video"); // Also consider Vimeo as embedded

  // Handle video element events
  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const handleMuteToggle = () => {
    if (videoRef.current) {
      const newMutedState = !isMuted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
      if (!newMutedState && volume === 0) { // If unmuting from 0, set a default volume
        videoRef.current.volume = 0.5;
        setVolume(0.5);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const dur = videoRef.current.duration;
      setCurrentTime(current);
      setDuration(dur);
      setProgress((current / dur) * 100 || 0);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const progressBar = e.currentTarget;
      const clickX = e.clientX - progressBar.getBoundingClientRect().left;
      const width = progressBar.offsetWidth;
      const newTime = (clickX / width) * duration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      setProgress((newTime / duration) * 100 || 0);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Auto-play and mute on load for direct videos
  useEffect(() => {
    if (videoRef.current && !isEmbeddedVideo) {
      videoRef.current.muted = true;
      videoRef.current.play().catch(error => console.log("Autoplay prevented:", error));
      setIsPlaying(true);
      setIsMuted(true);
      setVolume(0.5); // Reset volume for UI consistency
    }
  }, [processedUrl, isEmbeddedVideo]);

  return (
    <div className={cn("relative group rounded-3xl overflow-hidden bg-black shadow-2xl border border-border/50", className)}>
      {isEmbeddedVideo ? (
        <iframe
          ref={iframeRef}
          src={processedUrl}
          title={title}
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
          onEnded={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate} // Get duration when metadata loads
        />
      )}

      {/* Custom Controls Overlay for self-hosted videos */}
      {!isEmbeddedVideo && (
        <div className={cn(
          "absolute inset-0 flex flex-col justify-end bg-black/20 transition-opacity duration-300",
          isPlaying && "opacity-0 group-hover:opacity-100"
        )}>
          {/* Progress Bar */}
          <div 
            className="w-full h-2 bg-white/30 cursor-pointer relative"
            onClick={handleProgressClick}
          >
            <div 
              className="h-full bg-primary" 
              style={{ width: `${progress}%` }} 
            />
          </div>

          {/* Control Bar */}
          <div className="flex items-center justify-between p-4 bg-black/50">
            {/* Play/Pause Button */}
            <button
              onClick={handlePlayPause}
              className="p-2 rounded-full bg-primary text-white flex items-center justify-center hover:scale-105 transition-transform"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
            </button>

            {/* Time Display */}
            <div className="text-white text-sm font-mono mx-4">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleMuteToggle}
                className="p-2 rounded-full text-white hover:bg-white/20 transition-colors"
              >
                {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-24 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
              />
            </div>

            {/* Fullscreen Button (optional, can be added later) */}
            {/* <button className="p-2 rounded-full text-white hover:bg-white/20 transition-colors">
              <Maximize size={20} />
            </button> */}
          </div>
        </div>
      )}

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