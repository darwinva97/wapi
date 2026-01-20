'use client';

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Paperclip, X, Image, FileText, Film, Music } from "lucide-react";
import { sendMessageAction, sendMediaMessageAction } from "./actions";
import { toast } from "sonner";

interface ChatInputProps {
  slug: string;
  connectionSlug: string;
  chatId: string;
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
  if (type.startsWith('video/')) return <Film className="h-4 w-4" />;
  if (type.startsWith('audio/')) return <Music className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

export function ChatInput({ slug, connectionSlug, chatId }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!message.trim() && !selectedFile) return;

    startTransition(async () => {
      try {
        if (selectedFile) {
          const formData = new FormData();
          formData.append('file', selectedFile);
          if (message.trim()) {
            formData.append('caption', message.trim());
          }
          await sendMediaMessageAction(slug, connectionSlug, chatId, formData);
          setSelectedFile(null);
        } else {
          await sendMessageAction(slug, connectionSlug, chatId, message);
        }
        setMessage("");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to send message");
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 64MB for WhatsApp)
      if (file.size > 64 * 1024 * 1024) {
        toast.error("File is too large. Maximum 64MB.");
        return;
      }
      setSelectedFile(file);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="border-t">
      {selectedFile && (
        <div className="px-4 pt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md">
            {getFileIcon(selectedFile.type)}
            <span className="max-w-[200px] truncate">{selectedFile.name}</span>
            <span className="text-xs">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={clearFile}
              disabled={isPending}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
      <div className="p-4 flex gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isPending}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input
          placeholder={selectedFile ? "Add a caption (optional)..." : "Type a message..."}
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
        <Button
          size="icon"
          onClick={handleSend}
          disabled={isPending || (!message.trim() && !selectedFile)}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
