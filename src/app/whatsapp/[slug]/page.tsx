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
  Plus,
  Phone,
  Zap,
  Webhook,
} from "lucide-react";
import { Suspense } from "react";
import { getWAFromSlugUserIdCache } from "./cache";

function DetailSkeleton() {
  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <Skeleton className="h-32 w-full" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
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
    <div className="flex-1 overflow-auto">
      <div className="p-6 space-y-6">
        {/* Account Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>Información y estado de la cuenta</CardDescription>
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
                {connections.length} {connections.length === 1 ? "conexión" : "conexiones"} configurada{connections.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Button size="sm" asChild>
              <Link href={`/whatsapp/${wa.slug}/connections/create`}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva
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
                    <CardContent className="p-5">
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-semibold group-hover:text-primary transition-colors">
                            {connection.name}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {connection.description || "Sin descripción"}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {connection.senderEnabled ? (
                            <Badge variant="default" className="gap-1 text-xs">
                              <Zap className="h-3 w-3" />
                              Sender
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Zap className="h-3 w-3" />
                              Sender
                            </Badge>
                          )}

                          {connection.receiverEnabled ? (
                            <Badge variant="default" className="gap-1 text-xs">
                              <Webhook className="h-3 w-3" />
                              Receiver
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Webhook className="h-3 w-3" />
                              Receiver
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
      </div>
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