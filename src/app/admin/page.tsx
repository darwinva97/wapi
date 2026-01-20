import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Users, Database, Shield } from "lucide-react";
import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Panel de Administración</h1>
        <p className="text-muted-foreground">
          Gestiona la configuración global de la plataforma
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/admin/platform">
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Settings className="h-6 w-6" />
              </div>
              <div>
                <CardTitle>Configuración de Plataforma</CardTitle>
                <CardDescription>
                  Registro, límites y permisos globales
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/users">
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <CardTitle>Gestión de Usuarios</CardTitle>
                <CardDescription>
                  Administra usuarios y sus permisos
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/storage">
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <CardTitle>Almacenamiento</CardTitle>
                <CardDescription>
                  Configuración de storage local o S3
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Card className="h-full opacity-50">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>Seguridad</CardTitle>
              <CardDescription>
                Próximamente: logs de auditoría
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
