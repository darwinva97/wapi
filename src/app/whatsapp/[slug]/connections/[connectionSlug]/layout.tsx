import { auth } from "@/lib/auth";
import { db } from "@/db";
import { whatsappTable, connectionTable } from "@/db/schema";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit } from "lucide-react";
import { Suspense } from "react";

async function ConnectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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
    <div className="flex-1 min-h-0 overflow-auto -m-8 -mb-4">
      <div className="p-8 pb-4">
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
            <Button asChild>
              <Link href={`/whatsapp/${wa.slug}/connections/${connection.slug}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> Editar
              </Link>
            </Button>
          </div>
        </div>

        {children}
        </div>
      </div>
    </div>
  );
}

export default async function ConnectionLayoutWrapper({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; connectionSlug: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando conexión...</div>}>
      <ConnectionLayout params={params}>
        {children}
      </ConnectionLayout>
    </Suspense>
  )
}