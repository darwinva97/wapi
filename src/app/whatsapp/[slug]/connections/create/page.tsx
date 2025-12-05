import { auth } from "@/lib/auth";
import { db } from "@/db";
import { whatsappTable } from "@/db/schema";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { createConnectionAction } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export default async function CreateConnectionView({
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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl">
        <form action={createConnectionAction}>
          <input type="hidden" name="whatsappSlug" value={wa.slug} />
          <Card>
            <CardHeader>
              <CardTitle>Nueva Conexión para {wa.name}</CardTitle>
              <CardDescription>Configura cómo interactuará esta conexión con tu cuenta de WhatsApp.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (Identificador único)</Label>
                <Input id="slug" name="slug" required />
                <p className="text-xs">Se usará en la URL. Debe ser único.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea id="description" name="description" placeholder="Para qué sirve esta conexión..." />
              </div>

              <div className="space-y-4 border p-4 rounded-md">
                <div className="flex items-center space-x-2">
                  <Checkbox id="receiverEnabled" name="receiverEnabled" />
                  <Label htmlFor="receiverEnabled">Habilitar Receiver</Label>
                </div>
                <p className="text-sm ml-6">Permite recibir mensajes y eventos de WhatsApp (Webhooks).</p>
              </div>

              <div className="space-y-4 border p-4 rounded-md">
                <div className="flex items-center space-x-2">
                  <Checkbox id="senderEnabled" name="senderEnabled" />
                  <Label htmlFor="senderEnabled">Habilitar Sender</Label>
                </div>
                <p className="text-sm ml-6">Permite enviar mensajes a través de la API.</p>
              </div>

            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
              <Button variant="outline" asChild>
                <Link href={`/whatsapp/${wa.slug}`}>Cancelar</Link>
              </Button>
              <Button type="submit">Crear Conexión</Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  );
}
