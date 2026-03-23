import { auth } from "@/lib/auth";
import { db } from "@/db";
import { whatsappTable, connectionTable } from "@/db/schema";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { TestConnection } from "./test-connection";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
    <>
      <Card>
        <CardHeader>
          <CardTitle className="font-mono">Detalles de la Conexión</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div className="text-sm text-muted-foreground">Nombre</div>
              <div className="mt-1 text-sm font-medium">{connection.name}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Slug</div>
              <div className="mt-1 text-sm font-medium">{connection.slug}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Descripción</div>
              <div className="mt-1 text-sm font-medium">{connection.description || '-'}</div>
            </div>
          </div>

          {connection.senderEnabled && (
            <>
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground">Sender Token</div>
                <div className="mt-1 text-sm font-mono bg-muted rounded-lg p-3 break-all">
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
                  <div className="text-sm text-muted-foreground">Receiver Request Config</div>
                  <pre className="mt-1 text-xs font-mono bg-muted rounded-lg p-3 whitespace-pre-wrap">
                    {connection.receiverRequest ? JSON.stringify(connection.receiverRequest, null, 2) : 'No configurado'}
                  </pre>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Receiver Filter</div>
                  <pre className="mt-1 text-xs font-mono bg-muted rounded-lg p-3 whitespace-pre-wrap">
                    {connection.receiverFilter ? JSON.stringify(connection.receiverFilter, null, 2) : 'No configurado'}
                  </pre>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <TestConnection
        connection={connection}
        whatsappSlug={slug}
        connectionSlug={connectionSlug}
      />
    </>
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
