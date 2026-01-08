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
import { ArrowLeft, MessageCircle, Webhook } from "lucide-react";

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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/whatsapp/${wa.slug}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Webhook className="h-4 w-4" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Nueva Conexión</h2>
            <p className="text-xs text-muted-foreground">{wa.name}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl py-6">
          <form action={createConnectionAction}>
            <input type="hidden" name="whatsappSlug" value={wa.slug} />
            <Card>
              <CardHeader>
                <CardTitle>Configurar Conexión</CardTitle>
                <CardDescription>
                  Define cómo esta conexión interactuará con tu cuenta de WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input id="name" name="name" placeholder="Ej: Integración CRM" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">
                    Slug <span className="text-muted-foreground">(Identificador único)</span>
                  </Label>
                  <Input id="slug" name="slug" placeholder="Ej: integracion-crm" required />
                  <p className="text-xs text-muted-foreground">
                    Se usará en la URL y API. Debe ser único.
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

                <div className="space-y-4 border rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="receiverEnabled" name="receiverEnabled" />
                    <Label htmlFor="receiverEnabled" className="font-medium">
                      Habilitar Receiver
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground ml-6">
                    Permite recibir mensajes y eventos de WhatsApp vía webhooks
                  </p>
                </div>

                <div className="space-y-4 border rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="senderEnabled" name="senderEnabled" />
                    <Label htmlFor="senderEnabled" className="font-medium">
                      Habilitar Sender
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground ml-6">
                    Permite enviar mensajes a través de la API REST
                  </p>
                </div>

              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button variant="outline" type="button" asChild>
                  <Link href={`/whatsapp/${wa.slug}`}>Cancelar</Link>
                </Button>
                <Button type="submit">Crear Conexión</Button>
              </CardFooter>
            </Card>
          </form>
        </div>
      </div>
    </div>
  );
}
