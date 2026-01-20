"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getMembersAction,
  addMemberAction,
  updateMemberRoleAction,
  removeMemberAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import {
  UserPlus,
  Crown,
  Shield,
  User,
  MoreVertical,
  Trash2,
  AlertCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Member = {
  id: string;
  role: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
  createdBy: {
    id: string;
    name: string;
  } | null;
};

const roleIcons = {
  owner: Crown,
  manager: Shield,
  agent: User,
};

const roleLabels = {
  owner: "Propietario",
  manager: "Manager",
  agent: "Agente",
};

const roleColors = {
  owner: "text-amber-500 bg-amber-500/10",
  manager: "text-blue-500 bg-blue-500/10",
  agent: "text-green-500 bg-green-500/10",
};

export default function MembersPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const loadMembers = async () => {
    try {
      const data = await getMembersAction(slug);
      setMembers(data);
    } catch (err) {
      console.error("Error loading members:", err);
      setError("Error al cargar los miembros");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [slug]);

  const handleAddMember = async (formData: FormData) => {
    setAddLoading(true);
    setAddError("");
    try {
      const result = await addMemberAction(slug, formData);
      if (result.success) {
        setAddDialogOpen(false);
        loadMembers();
      } else {
        setAddError(result.error || "Error al agregar miembro");
      }
    } catch (err) {
      console.error("Error adding member:", err);
      setAddError("Error al agregar miembro");
    } finally {
      setAddLoading(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      const result = await updateMemberRoleAction(
        slug,
        memberId,
        newRole as "owner" | "manager" | "agent"
      );
      if (result.success) {
        loadMembers();
      } else {
        alert(result.error);
      }
    } catch (err) {
      console.error("Error updating role:", err);
      alert("Error al actualizar el rol");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const result = await removeMemberAction(slug, memberId);
      if (result.success) {
        loadMembers();
      } else {
        alert(result.error);
      }
    } catch (err) {
      console.error("Error removing member:", err);
      alert("Error al eliminar miembro");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Miembros</h1>
            <p className="text-muted-foreground">
              {members.length} miembro{members.length !== 1 ? "s" : ""} en esta
              instancia
            </p>
          </div>
        </div>

        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Agregar miembro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar nuevo miembro</DialogTitle>
              <DialogDescription>
                Invita a un usuario a esta instancia de WhatsApp
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddMember(new FormData(e.currentTarget));
              }}
            >
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email del usuario</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="usuario@ejemplo.com"
                    required
                    disabled={addLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    El usuario debe estar registrado en la plataforma
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol</Label>
                  <Select name="role" defaultValue="agent">
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agent">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-green-500" />
                          <span>Agente</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="manager">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-500" />
                          <span>Manager</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="owner">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4 text-amber-500" />
                          <span>Propietario</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {addError && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{addError}</AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={addLoading}>
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={addLoading}>
                  {addLoading ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Agregando...
                    </>
                  ) : (
                    "Agregar"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Equipo</CardTitle>
          <CardDescription>
            Usuarios con acceso a esta instancia de WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {members.map((member) => {
              const RoleIcon =
                roleIcons[member.role as keyof typeof roleIcons] || User;
              const roleLabel =
                roleLabels[member.role as keyof typeof roleLabels] ||
                member.role;
              const roleColor =
                roleColors[member.role as keyof typeof roleColors] ||
                "text-muted-foreground bg-muted";

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${roleColor}`}
                    >
                      <RoleIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{member.user.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {roleLabel}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {member.user.email}
                      </p>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleUpdateRole(member.id, "agent")}
                        disabled={member.role === "agent"}
                      >
                        <User className="mr-2 h-4 w-4 text-green-500" />
                        Cambiar a Agente
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleUpdateRole(member.id, "manager")}
                        disabled={member.role === "manager"}
                      >
                        <Shield className="mr-2 h-4 w-4 text-blue-500" />
                        Cambiar a Manager
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleUpdateRole(member.id, "owner")}
                        disabled={member.role === "owner"}
                      >
                        <Crown className="mr-2 h-4 w-4 text-amber-500" />
                        Cambiar a Propietario
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem
                            onSelect={(e) => e.preventDefault()}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              ¿Eliminar miembro?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {member.user.name} perderá acceso a esta instancia
                              de WhatsApp. Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveMember(member.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Role descriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Descripción de roles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div className="flex gap-3">
              <Crown className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="font-medium">Propietario</p>
                <p className="text-muted-foreground">
                  Control total. Puede agregar/eliminar cualquier rol, eliminar
                  la instancia, y gestionar todas las configuraciones.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Shield className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <p className="font-medium">Manager</p>
                <p className="text-muted-foreground">
                  Gestión avanzada. Puede agregar managers y agentes, gestionar
                  conexiones y configuración, pero no puede eliminar
                  propietarios.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <User className="h-5 w-5 text-green-500 shrink-0" />
              <div>
                <p className="font-medium">Agente</p>
                <p className="text-muted-foreground">
                  Operador de chat. Puede enviar y recibir mensajes, ver chats,
                  y configurar retención de archivos dentro del límite
                  permitido.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
