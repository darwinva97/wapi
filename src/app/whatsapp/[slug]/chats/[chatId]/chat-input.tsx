'use client';

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { sendMessageAction } from "./actions";
import { toast } from "sonner";

interface ChatInputProps {
  slug: string;
  chatId: string;
}

export function ChatInput({ slug, chatId }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSend = () => {
    if (!message.trim()) return;

    startTransition(async () => {
      try {
        await sendMessageAction(slug, chatId, message);
        setMessage("");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al enviar mensaje");
      }
    });
  };

  return (
    <div className="p-4 border-t flex gap-2">
      <Input
        placeholder="Escribe un mensaje..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        disabled={isPending}
      />
      <Button size="icon" onClick={handleSend} disabled={isPending || !message.trim()}>
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
