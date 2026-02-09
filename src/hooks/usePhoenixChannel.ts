"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Channel } from "phoenix";
import { getChannel, leaveChannel } from "@/lib/elixir-client";

interface UsePhoenixChannelReturn {
  channel: Channel | null;
  connected: boolean;
  error: string | null;
}

export function usePhoenixChannel(
  topic: string | null,
  params: Record<string, unknown> = {}
): UsePhoenixChannelReturn {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<Channel | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    if (!topic) return;

    try {
      const channel = getChannel(topic, paramsRef.current);
      channelRef.current = channel;

      channel
        .join()
        .receive("ok", () => {
          setConnected(true);
          setError(null);
        })
        .receive("error", (resp: { reason?: string }) => {
          setError(resp.reason || "Failed to join channel");
          setConnected(false);
        })
        .receive("timeout", () => {
          setError("Connection timeout");
          setConnected(false);
        });

      return () => {
        leaveChannel(topic);
        channelRef.current = null;
        setConnected(false);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection error");
      return undefined;
    }
  }, [topic]);

  return {
    channel: channelRef.current,
    connected,
    error,
  };
}
