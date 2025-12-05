import { auth } from "@/lib/auth";
import { db } from "@/db";
import { whatsappTable, connectionTable } from "@/db/schema";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { ConnectButton } from "./connect-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Edit } from "lucide-react";
import { Suspense } from "react";

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

  const wa = await db.query.whatsappTable.findFirst({
    where: and(
      eq(whatsappTable.slug, slug),
      eq(whatsappTable.userId, session.user.id)
    ),
  });

  if (!wa) {
    notFound();
  }

  const connections = await db.query.connectionTable.findMany({
    where: eq(connectionTable.whatsappId, wa.id),
  });

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              {wa.name}
            </h1>
            <Badge variant={wa.connected ? 'default' : 'destructive'}>
              {wa.connected ? 'Conectado' : 'Desconectado'}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/whatsapp/${wa.slug}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> Editar
              </Link>
            </Button>
            <ConnectButton id={wa.id} isConnected={wa.connected} />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Detalles de la cuenta</CardTitle>
            <CardDescription>Información y configuración.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <div className="text-sm font-medium">Nombre</div>
                <div className="mt-1 text-sm">{wa.name}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Slug</div>
                <div className="mt-1 text-sm">{wa.slug}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Número de teléfono</div>
                <div className="mt-1 text-sm">{wa.phoneNumber}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Descripción</div>
                <div className="mt-1 text-sm">{wa.description || '-'}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Estado</div>
                <div className="mt-1 text-sm">{wa.enabled ? 'Habilitado' : 'Deshabilitado'}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Conexiones</h2>
            <Button asChild>
              <Link href={`/whatsapp/${wa.slug}/connections/create`}>
                <Plus className="mr-2 h-4 w-4" /> Agregar
              </Link>
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {connections.length === 0 ? (
                <div className="p-6 text-center">
                  No hay conexiones creadas.
                </div>
              ) : (
                <div className="divide-y">
                  {connections.map((connection) => (
                    <Link
                      key={connection.id}
                      href={`/whatsapp/${wa.slug}/connections/${connection.slug}`}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <div className="font-medium text-blue-600">{connection.name}</div>
                        <div className="text-sm">{connection.description || 'Sin descripción'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={connection.senderEnabled ? 'outline' : 'secondary'}>
                          {connection.senderEnabled ? 'Sender Activo' : 'Sender Inactivo'}
                        </Badge>
                        <Badge variant={connection.receiverEnabled ? 'outline' : 'secondary'}>
                          {connection.receiverEnabled ? 'Receiver Activo' : 'Receiver Inactivo'}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando...</div>}>
    <WhatsappDetailView params={params} />
  </Suspense>;
}