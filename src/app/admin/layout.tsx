import { Suspense } from "react";
import { requirePlatformAdmin } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  ArrowLeft,
  Settings,
  Users,
  Database,
} from "lucide-react";

async function AdminLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requirePlatformAdmin();
  } catch {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b p-4">
            <Button variant="ghost" size="sm" asChild className="w-full justify-start">
              <Link href="/" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver al inicio
              </Link>
            </Button>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-1 p-4">
            <p className="mb-2 px-2 text-xs font-semibold uppercase text-muted-foreground">
              Administración
            </p>
            <Button variant="ghost" className="w-full justify-start" asChild>
              <Link href="/admin/platform">
                <Settings className="mr-2 h-4 w-4" />
                Configuración
              </Link>
            </Button>
            <Button variant="ghost" className="w-full justify-start" asChild>
              <Link href="/admin/users">
                <Users className="mr-2 h-4 w-4" />
                Usuarios
              </Link>
            </Button>
            <Button variant="ghost" className="w-full justify-start" asChild>
              <Link href="/admin/storage">
                <Database className="mr-2 h-4 w-4" />
                Almacenamiento
              </Link>
            </Button>
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto max-w-4xl py-8">{children}</div>
      </main>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}
