import { auth } from "@/lib/auth";
import { db } from "@/db";
import { whatsappTable, connectionTable } from "@/db/schema";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { TestConnection } from "./test-connection";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Edit, Users, MessageSquare } from "lucide-react";

async function ConnectionDetailView({
  params,
}: {
  params: Promise<{ slug: string; connectionSlug: string }>;
}) {
  const { slug, connectionSlug } = await params;
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

  const connection = await db.query.connectionTable.findFirst({
    where: and(
      eq(connectionTable.slug, connectionSlug),
      eq(connectionTable.whatsappId, wa.id)
    ),
  });

  if (!connection) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/whatsapp/${wa.slug}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              {connection.name}
            </h1>
            <div className="flex gap-2">
              <Badge variant={connection.receiverEnabled ? 'default' : 'secondary'}>
                Receiver: {connection.receiverEnabled ? 'ON' : 'OFF'}
              </Badge>
              <Badge variant={connection.senderEnabled ? 'default' : 'secondary'}>
                Sender: {connection.senderEnabled ? 'ON' : 'OFF'}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/whatsapp/${wa.slug}/connections/${connection.slug}/chats`}>
                <MessageSquare className="mr-2 h-4 w-4" /> Chats
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/whatsapp/${wa.slug}/connections/${connection.slug}/contacts`}>
                <Users className="mr-2 h-4 w-4" /> Contacts
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/whatsapp/${wa.slug}/connections/${connection.slug}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> Editar
              </Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Detalles de la Conexión</CardTitle>
            <CardDescription>Configuración y credenciales.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <div className="text-sm font-medium">Nombre</div>
                <div className="mt-1 text-sm">{connection.name}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Slug</div>
                <div className="mt-1 text-sm">{connection.slug}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Descripción</div>
                <div className="mt-1 text-sm">{connection.description || '-'}</div>
              </div>
            </div>

            {connection.senderEnabled && (
              <>
                <Separator />
                <div>
                  <div className="text-sm font-medium">Sender Token</div>
                  <div className="mt-1 text-sm font-mono bg-muted p-2 rounded break-all">
                    {connection.senderToken}
                  </div>
                </div>
              </>
            )}

            {connection.receiverEnabled && (
              <>
                <Separator />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-medium">Receiver Request Config</div>
                    <pre className="mt-1 text-xs font-mono bg-muted p-2 rounded whitespace-pre-wrap">
                      {connection.receiverRequest ? JSON.stringify(connection.receiverRequest, null, 2) : 'No configurado'}
                    </pre>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Receiver Filter</div>
                    <pre className="mt-1 text-xs font-mono bg-muted p-2 rounded whitespace-pre-wrap">
                      {connection.receiverFilter ? JSON.stringify(connection.receiverFilter, null, 2) : 'No configurado'}
                    </pre>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <TestConnection connection={connection} />
      </div>
    </div>
  );
}

export default async function ConnectionDetail({
  params,
}: {
  params: Promise<{ slug: string; connectionSlug: string }>;
}) {
  return <Suspense fallback={<div>Loading...</div>}>
    <ConnectionDetailView params={params} />
  </Suspense>;
}