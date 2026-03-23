import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { whatsappTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, Plus, Phone, Users, Settings } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";

function DashboardSkeleton() {
  return (
    <div className="min-h-screen">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-10 h-16 border-b bg-card">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-12">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-28 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-full" />
            <Skeleton className="h-9 w-36 rounded-full" />
          </div>
        </div>
      </header>

      {/* Main Content Skeleton */}
      <main className="mx-auto max-w-7xl px-12 py-8">
        <div className="mb-8">
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

async function Dashboard() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const whatsapps = await db
    .select()
    .from(whatsappTable)
    .where(eq(whatsappTable.userId, session.user.id));

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 border-b bg-card">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-12">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-white text-sm font-bold">
              W
            </div>
            <span className="font-mono font-bold text-lg">WAPI</span>
            <span className="text-muted-foreground text-sm">Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            {session.user.role === "admin" && (
              <>
                <Button variant="ghost" size="sm" className="rounded-full" asChild>
                  <Link href="/admin/users">
                    <Users className="mr-2 h-4 w-4" />
                    Usuarios
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" className="rounded-full" asChild>
                  <Link href="/admin/platform">
                    <Settings className="mr-2 h-4 w-4" />
                    Configuración
                  </Link>
                </Button>
              </>
            )}
            <LogoutButton />
            <Button size="sm" className="rounded-full" asChild>
              <Link href="/whatsapp/create">
                <Plus className="mr-2 h-4 w-4" />
                Agregar WhatsApp
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-12 py-8">
        <div className="mb-8">
          <h2 className="font-mono text-3xl font-semibold tracking-tight">
            Mis WhatsApps
          </h2>
          <p className="mt-1 text-muted-foreground">
            Gestiona tus cuentas de WhatsApp y conexiones
          </p>
        </div>

        {whatsapps.length === 0 ? (
          <Empty className="border-muted-foreground/20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageCircle className="h-6 w-6" strokeWidth={2} />
              </EmptyMedia>
              <EmptyTitle>No hay cuentas de WhatsApp</EmptyTitle>
              <EmptyDescription>
                Comienza conectando tu primera cuenta de WhatsApp para empezar a enviar y recibir mensajes.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button className="rounded-full" asChild>
                <Link href="/whatsapp/create">
                  <Plus className="mr-2 h-4 w-4" />
                  Conectar cuenta
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {whatsapps.map((wa) => (
              <Link key={wa.id} href={`/whatsapp/${wa.slug}`} className="group">
                <Card className="shadow-sm transition-all hover:shadow-md hover:border-primary/50">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          wa.connected
                            ? "bg-orange-500 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Phone className="h-5 w-5" strokeWidth={2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                          {wa.name}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {wa.phoneNumber || "Sin número"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          wa.connected
                            ? "bg-[var(--color-success)] text-[var(--color-success-foreground)]"
                            : "bg-[var(--color-error)] text-[var(--color-error-foreground)]"
                        }`}
                      >
                        {wa.connected ? "Online" : "Offline"}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          wa.enabled
                            ? "bg-[var(--color-success)] text-[var(--color-success-foreground)]"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {wa.enabled ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}
