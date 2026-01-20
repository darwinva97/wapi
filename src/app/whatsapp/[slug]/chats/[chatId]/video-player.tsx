'use client';

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Maximize2, Volume2, VolumeX, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  src: string;
  fileName?: string | null;
  fromMe?: boolean;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VideoPlayer({ src, fileName, fromMe }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoaded(true);
    };
    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);

  // Auto-hide controls
  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      return;
    }

    const timer = setTimeout(() => setShowControls(false), 2000);
    return () => clearTimeout(timer);
  }, [isPlaying, showControls]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    video.currentTime = percent * duration;
  };

  const handleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative rounded-lg overflow-hidden bg-black max-w-full group"
      onMouseEnter={() => setShowControls(true)}
      onMouseMove={() => setShowControls(true)}
    >
      <video
        ref={videoRef}
        src={src}
        className="max-w-full max-h-64 w-auto h-auto"
        preload="metadata"
        playsInline
        onClick={togglePlay}
      />

      {/* Play button overlay (when paused) */}
      {!isPlaying && isLoaded && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity"
        >
          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <Play className="h-7 w-7 text-gray-800 ml-1" />
          </div>
        </button>
      )}

      {/* Controls overlay */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 transition-opacity",
          showControls || !isPlaying ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Progress bar */}
        <div
          className="h-1 bg-white/30 rounded-full cursor-pointer mb-2 group/progress"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-white rounded-full relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </button>

            <button
              onClick={toggleMute}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>

            <span className="text-xs">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <a
              href={src}
              download={fileName || 'video'}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              onClick={handleFullscreen}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
