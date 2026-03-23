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
    <div className="p-8 pb-4">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header row with back button, title, badges, and edit button */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href={`/whatsapp/${wa.slug}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg font-semibold truncate">{connection.name}</span>
            <Badge variant={connection.receiverEnabled ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 shrink-0">
              Receiver: {connection.receiverEnabled ? 'ON' : 'OFF'}
            </Badge>
            <Badge variant={connection.senderEnabled ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 shrink-0">
              Sender: {connection.senderEnabled ? 'ON' : 'OFF'}
            </Badge>
          </div>
          <Button size="sm" asChild className="shrink-0">
            <Link href={`/whatsapp/${wa.slug}/connections/${connection.slug}/edit`}>
              <Edit className="mr-2 h-3 w-3" /> Editar
            </Link>
          </Button>
        </div>

        {children}
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