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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, Plus, Phone, LogOut } from "lucide-react";

function DashboardSkeleton() {
  return (
    <div className="min-h-screen space-y-8 p-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
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
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessageCircle className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">WAPI</h1>
              <p className="text-xs text-muted-foreground">Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/api/auth/sign-out">
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/whatsapp/create">
                <Plus className="mr-2 h-4 w-4" />
                Agregar WhatsApp
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Mis WhatsApps</h2>
            <p className="text-muted-foreground">
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
                <Button asChild>
                  <Link href="/whatsapp/create">
                    <Plus className="mr-2 h-4 w-4" />
                    Conectar cuenta
                  </Link>
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {whatsapps.map((wa) => (
                <Link key={wa.id} href={`/whatsapp/${wa.slug}`} className="group">
                  <Card className="transition-all hover:shadow-md hover:border-primary/50">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${wa.connected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          <Phone className="h-6 w-6" strokeWidth={2} />
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
                        <Badge variant={wa.connected ? "default" : "secondary"} className="text-xs">
                          {wa.connected ? "Online" : "Offline"}
                        </Badge>
                        <Badge variant={wa.enabled ? "default" : "destructive"} className="text-xs">
                          {wa.enabled ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
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