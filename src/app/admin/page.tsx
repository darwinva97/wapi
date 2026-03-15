import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Users, Database, Shield } from "lucide-react";
import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-mono text-3xl font-bold tracking-tight">
          Panel de Administración
        </h1>
        <p className="mt-1 text-muted-foreground">
          Gestiona la configuración global de la plataforma
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/admin/platform">
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
                <Settings className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="font-mono">Configuración de Plataforma</CardTitle>
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
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="font-mono">Gestión de Usuarios</CardTitle>
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
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="font-mono">Almacenamiento</CardTitle>
                <CardDescription>
                  Configuración de storage local o S3
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Card className="h-full opacity-50">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="font-mono">Seguridad</CardTitle>
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
