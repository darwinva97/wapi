"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { deleteWhatsappAction } from "./actions";

interface DeleteWhatsappButtonProps {
  slug: string;
  name: string;
}

export function DeleteWhatsappButton({ slug, name }: DeleteWhatsappButtonProps) {
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const isConfirmed = confirmText === name;

  async function handleDelete() {
    if (!isConfirmed) return;

    setIsDeleting(true);
    try {
      await deleteWhatsappAction(slug);
      router.push("/whatsapp");
    } catch (error) {
      console.error("Error deleting WhatsApp instance:", error);
      setIsDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="w-full">
          <Trash2 className="w-4 h-4 mr-2" />
          Eliminar instancia
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar instancia de WhatsApp</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Esta acción eliminará permanentemente la instancia <strong>{name}</strong> y todos sus datos asociados:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>Todos los contactos</li>
              <li>Todos los grupos</li>
              <li>Todos los mensajes</li>
              <li>Todas las conexiones API</li>
              <li>Archivos de sesión</li>
            </ul>
            <p className="font-medium text-destructive">
              Esta acción no se puede deshacer.
            </p>
            <div className="pt-2">
              <p className="text-sm mb-2">
                Escribe <strong>{name}</strong> para confirmar:
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={name}
                className="font-mono"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmText("")}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Eliminando..." : "Eliminar permanentemente"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
