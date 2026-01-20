'use client';

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Info,
  Link as LinkIcon,
  Image as ImageIcon,
  StickyNote,
  Trash2,
  Edit,
  Plus,
  ExternalLink,
  FileText,
  Film,
  Music,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  updateChatConfigAction,
  createNoteAction,
  deleteNoteAction,
  type ChatInfoData,
  type ChatLink,
  type ChatAsset,
  type ChatNote,
} from "./chat-info-actions";

interface ChatInfoPanelProps {
  slug: string;
  chatId: string;
  chatName: string;
  chatInfo: ChatInfoData;
  links: ChatLink[];
  assets: ChatAsset[];
  notes: ChatNote[];
  canManageNotes: boolean;
}

function getAssetIcon(type: string) {
  if (type === 'image' || type === 'sticker') return <ImageIcon className="h-4 w-4" />;
  if (type === 'video') return <Film className="h-4 w-4" />;
  if (type === 'audio') return <Music className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

export function ChatInfoPanel({
  slug,
  chatId,
  chatName,
  chatInfo,
  links,
  assets,
  notes,
  canManageNotes,
}: ChatInfoPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customName, setCustomName] = useState(chatInfo.config?.customName || "");
  const [cleanupExcluded, setCleanupExcluded] = useState(chatInfo.config?.cleanupExcluded || false);
  const [cleanupIncluded, setCleanupIncluded] = useState(chatInfo.config?.cleanupIncluded || false);
  const [newNote, setNewNote] = useState("");
  const [assetFilter, setAssetFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  const handleSaveConfig = () => {
    startTransition(async () => {
      try {
        await updateChatConfigAction(slug, chatId, {
          customName: customName || null,
          cleanupExcluded,
          cleanupIncluded,
        });
        toast.success("Configuración guardada");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al guardar");
      }
    });
  };

  const handleCreateNote = () => {
    if (!newNote.trim()) return;

    startTransition(async () => {
      try {
        await createNoteAction(slug, chatId, newNote.trim());
        setNewNote("");
        toast.success("Nota creada");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al crear nota");
      }
    });
  };

  const handleDeleteNote = (noteId: string) => {
    startTransition(async () => {
      try {
        await deleteNoteAction(slug, chatId, noteId);
        toast.success("Nota eliminada");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al eliminar nota");
      }
    });
  };

  const filteredAssets = assetFilter === "all"
    ? assets
    : assets.filter(a => a.type === assetFilter);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button className="text-left hover:bg-muted/50 px-4 py-3 border-b bg-background shrink-0 w-full transition-colors">
          <h3 className="font-semibold">{chatInfo.config?.customName || chatName}</h3>
          <p className="text-xs text-muted-foreground font-mono">{chatId}</p>
        </button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>Información del Chat</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="info" className="h-full">
          <TabsList className="w-full justify-start rounded-none border-b px-4 h-auto py-2 bg-transparent">
            <TabsTrigger value="info" className="gap-1.5">
              <Info className="h-4 w-4" /> Info
            </TabsTrigger>
            <TabsTrigger value="links" className="gap-1.5">
              <LinkIcon className="h-4 w-4" /> Links ({links.length})
            </TabsTrigger>
            <TabsTrigger value="assets" className="gap-1.5">
              <ImageIcon className="h-4 w-4" /> Media ({assets.length})
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5">
              <StickyNote className="h-4 w-4" /> Notas ({notes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="p-4 mt-0 h-[calc(100vh-140px)]">
            <ScrollArea className="h-full">
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3">Información General</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nombre</span>
                      <span>{chatName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tipo</span>
                      <span>{chatInfo.isGroup ? "Grupo" : "Personal"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ID</span>
                      <span className="font-mono text-xs">{chatId}</span>
                    </div>
                    {chatInfo.firstMessage && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Primer mensaje</span>
                        <span>{format(chatInfo.firstMessage, "dd/MM/yyyy HH:mm")}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total mensajes</span>
                      <span>{chatInfo.totalMessages}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total media</span>
                      <span>{chatInfo.totalMedia}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Configuración</h4>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="customName">Nombre personalizado</Label>
                      <Input
                        id="customName"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="Nombre personalizado para este chat..."
                        className="mt-1"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="cleanupExcluded" className="flex-1">
                        Excluir de limpieza automática
                      </Label>
                      <Switch
                        id="cleanupExcluded"
                        checked={cleanupExcluded}
                        onCheckedChange={setCleanupExcluded}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="cleanupIncluded" className="flex-1">
                        Incluir en limpieza (si excluido globalmente)
                      </Label>
                      <Switch
                        id="cleanupIncluded"
                        checked={cleanupIncluded}
                        onCheckedChange={setCleanupIncluded}
                      />
                    </div>

                    <Button onClick={handleSaveConfig} disabled={isPending} className="w-full">
                      Guardar cambios
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="links" className="p-4 mt-0 h-[calc(100vh-140px)]">
            <ScrollArea className="h-full">
              {links.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No se encontraron links en este chat
                </div>
              ) : (
                <div className="space-y-3">
                  {links.map((link, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1 break-all"
                        >
                          {link.url}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(link.timestamp, "dd/MM/yyyy HH:mm")} - {link.sender}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="assets" className="p-4 mt-0 h-[calc(100vh-140px)]">
            <div className="space-y-4 h-full flex flex-col">
              <div className="flex gap-2 flex-wrap shrink-0">
                <Button
                  variant={assetFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAssetFilter("all")}
                >
                  Todos
                </Button>
                <Button
                  variant={assetFilter === "image" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAssetFilter("image")}
                >
                  <ImageIcon className="h-4 w-4 mr-1" /> Imágenes
                </Button>
                <Button
                  variant={assetFilter === "video" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAssetFilter("video")}
                >
                  <Film className="h-4 w-4 mr-1" /> Videos
                </Button>
                <Button
                  variant={assetFilter === "audio" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAssetFilter("audio")}
                >
                  <Music className="h-4 w-4 mr-1" /> Audio
                </Button>
                <Button
                  variant={assetFilter === "document" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAssetFilter("document")}
                >
                  <FileText className="h-4 w-4 mr-1" /> Docs
                </Button>
              </div>

              <ScrollArea className="flex-1">
                {filteredAssets.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No se encontraron archivos
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {filteredAssets.map((asset) => (
                      <a
                        key={asset.messageId}
                        href={asset.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-square border rounded-lg overflow-hidden relative group"
                      >
                        {asset.type === 'image' || asset.type === 'sticker' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={asset.url}
                            alt="Media"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-muted p-2">
                            {getAssetIcon(asset.type)}
                            <span className="text-xs text-center mt-1 line-clamp-2">
                              {asset.fileName || asset.type}
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Download className="h-6 w-6 text-white" />
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="p-4 mt-0 h-[calc(100vh-140px)]">
            <div className="space-y-4 h-full flex flex-col">
              {canManageNotes && (
                <div className="space-y-2 shrink-0">
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Escribe una nota..."
                    rows={3}
                  />
                  <Button
                    onClick={handleCreateNote}
                    disabled={isPending || !newNote.trim()}
                    size="sm"
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Agregar nota
                  </Button>
                </div>
              )}

              <ScrollArea className="flex-1">
                {notes.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No hay notas para este chat
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div key={note.id} className="border rounded-lg p-3 space-y-2">
                        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {note.createdByName} - {format(note.createdAt, "dd/MM/yyyy HH:mm")}
                          </span>
                          {note.canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteNote(note.id)}
                              disabled={isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
