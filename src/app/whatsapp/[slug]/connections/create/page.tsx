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
import { ScrollArea } from "@/components/ui/scroll-area";

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
    <ScrollArea className="h-full">
      <div className="flex items-start justify-center p-6">
        <form action={createConnectionAction} className="w-full max-w-xl">
          <input type="hidden" name="whatsappSlug" value={wa.slug} />
          <Card>
            <CardHeader>
              <CardTitle className="font-mono">Nueva Conexión</CardTitle>
              <CardDescription>
                Configura una nueva integración para <span className="font-medium text-foreground">{wa.name}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" name="name" placeholder="Ej: Integración CRM" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" placeholder="Ej: integracion-crm" required />
                <p className="text-xs text-muted-foreground">
                  Identificador único. Se usará en la URL y API.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Para qué sirve esta conexión..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="receiverEnabled" name="receiverEnabled" />
                  <Label htmlFor="receiverEnabled" className="font-medium cursor-pointer">
                    Habilitar Receiver
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground ml-6">
                  Permite recibir mensajes y eventos de WhatsApp vía webhooks.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="senderEnabled" name="senderEnabled" />
                  <Label htmlFor="senderEnabled" className="font-medium cursor-pointer">
                    Habilitar Sender
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground ml-6">
                  Permite enviar mensajes a través de la API REST.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-full" type="button" asChild>
                <Link href={`/whatsapp/${wa.slug}`}>Cancelar</Link>
              </Button>
              <Button type="submit" className="rounded-full">Crear Conexión</Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </ScrollArea>
  );
}
