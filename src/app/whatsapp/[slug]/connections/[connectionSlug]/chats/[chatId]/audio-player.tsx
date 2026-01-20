'use client';

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
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

export function AudioPlayer({ src, fileName, fromMe }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * duration;
  };

  const cyclePlaybackRate = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const rates = [1, 1.5, 2, 0.5];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    audio.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 min-w-[200px] max-w-[280px]">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className={cn(
          "shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors",
          fromMe
            ? "bg-primary-foreground/20 hover:bg-primary-foreground/30"
            : "bg-primary/10 hover:bg-primary/20"
        )}
      >
        {isPlaying ? (
          <Pause className={cn("h-5 w-5", fromMe ? "text-primary-foreground" : "text-primary")} />
        ) : (
          <Play className={cn("h-5 w-5 ml-0.5", fromMe ? "text-primary-foreground" : "text-primary")} />
        )}
      </button>

      {/* Progress Section */}
      <div className="flex-1 min-w-0">
        {/* Waveform/Progress Bar */}
        <div
          className={cn(
            "h-8 rounded cursor-pointer relative flex items-center",
            fromMe ? "bg-primary-foreground/10" : "bg-muted"
          )}
          onClick={handleSeek}
        >
          {/* Fake waveform bars */}
          <div className="absolute inset-0 flex items-center justify-around px-1 gap-[2px]">
            {Array.from({ length: 30 }).map((_, i) => {
              const height = 20 + Math.sin(i * 0.5) * 15 + Math.random() * 10;
              const isPlayed = (i / 30) * 100 <= progress;
              return (
                <div
                  key={i}
                  className={cn(
                    "w-[3px] rounded-full transition-colors",
                    isPlayed
                      ? fromMe ? "bg-primary-foreground" : "bg-primary"
                      : fromMe ? "bg-primary-foreground/30" : "bg-muted-foreground/30"
                  )}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>
        </div>

        {/* Time and Controls */}
        <div className="flex items-center justify-between mt-1 text-[10px]">
          <span className={fromMe ? "text-primary-foreground/70" : "text-muted-foreground"}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={cyclePlaybackRate}
              className={cn(
                "px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors",
                fromMe
                  ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              )}
            >
              {playbackRate}x
            </button>
            <a
              href={src}
              download={fileName || 'audio'}
              className={cn(
                "p-1 rounded transition-colors",
                fromMe
                  ? "hover:bg-primary-foreground/20 text-primary-foreground/70"
                  : "hover:bg-muted text-muted-foreground"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
