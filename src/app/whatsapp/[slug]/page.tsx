import { auth } from "@/lib/auth";
import { db } from "@/db";
import { connectionTable } from "@/db/schema";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  ArrowLeft,
  Plus,
  MessageCircle,
  Phone,
  Settings,
  Check,
  X,
  Zap,
  Webhook,
} from "lucide-react";
import { Suspense } from "react";
import { getWAFromSlugUserIdCache } from "./cache";

function DetailSkeleton() {
  return (
    <div className="min-h-screen space-y-6 p-4 sm:p-6 lg:p-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-8 w-32" />
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

async function WhatsappDetailView({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const wa = await getWAFromSlugUserIdCache({ slug, userId: session.user.id });

  if (!wa) {
    notFound();
  }

  const connections = await db.query.connectionTable.findMany({
    where: eq(connectionTable.whatsappId, wa.id),
  });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${wa.connected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                <MessageCircle className="h-5 w-5" strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-lg font-semibold">{wa.name}</h1>
                <p className="text-xs text-muted-foreground">{wa.phoneNumber}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={wa.connected ? "default" : "secondary"} className="gap-1">
              {wa.connected ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              {wa.connected ? "Conectado" : "Desconectado"}
            </Badge>
            <Badge variant={wa.enabled ? "default" : "destructive"}>
              {wa.enabled ? "Activo" : "Inactivo"}
            </Badge>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/whatsapp/${wa.slug}/edit`}>
                <Settings className="mr-2 h-4 w-4" />
                Editar
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Account Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Información de la cuenta</CardTitle>
            <CardDescription>Detalles y configuración de WhatsApp</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Nombre</div>
                <div className="text-sm font-medium">{wa.name}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Slug</div>
                <div className="text-sm font-mono text-xs">{wa.slug}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Teléfono</div>
                <div className="text-sm flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {wa.phoneNumber}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Descripción</div>
                <div className="text-sm">{wa.description || "Sin descripción"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Connections Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Conexiones</h2>
              <p className="text-sm text-muted-foreground">
                Configura integraciones para enviar y recibir mensajes
              </p>
            </div>
            <Button asChild>
              <Link href={`/whatsapp/${wa.slug}/connections/create`}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva conexión
              </Link>
            </Button>
          </div>

          {connections.length === 0 ? (
            <Empty className="border-muted-foreground/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Webhook className="h-6 w-6" strokeWidth={2} />
                </EmptyMedia>
                <EmptyTitle>No hay conexiones</EmptyTitle>
                <EmptyDescription>
                  Crea tu primera conexión para integrar esta cuenta de WhatsApp con tus aplicaciones.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild>
                  <Link href={`/whatsapp/${wa.slug}/connections/create`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear conexión
                  </Link>
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {connections.map((connection) => (
                <Link
                  key={connection.id}
                  href={`/whatsapp/${wa.slug}/connections/${connection.slug}`}
                  className="group"
                >
                  <Card className="h-full transition-all hover:shadow-md hover:border-primary/50">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold group-hover:text-primary transition-colors">
                              {connection.name}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {connection.description || "Sin descripción"}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {connection.senderEnabled ? (
                            <Badge variant="default" className="gap-1 text-xs">
                              <Zap className="h-3 w-3" />
                              Sender Activo
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Zap className="h-3 w-3" />
                              Sender Inactivo
                            </Badge>
                          )}

                          {connection.receiverEnabled ? (
                            <Badge variant="default" className="gap-1 text-xs">
                              <Webhook className="h-3 w-3" />
                              Receiver Activo
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Webhook className="h-3 w-3" />
                              Receiver Inactivo
                            </Badge>
                          )}
                        </div>
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

export default async function WhatsappDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <WhatsappDetailView params={params} />
    </Suspense>
  );
}