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
import { Zap, Webhook } from "lucide-react";

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
    <div className="flex-1 overflow-auto">
      <ScrollArea className="h-full">
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          {/* Page Header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Nueva Conexión</h1>
            <p className="text-muted-foreground">
              Configura una nueva integración para <span className="font-medium text-foreground">{wa.name}</span>
            </p>
          </div>

          {/* Form */}
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
                    <Label htmlFor="receiverEnabled" className="font-medium cursor-pointer">
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
                    <Label htmlFor="senderEnabled" className="font-medium cursor-pointer">
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
      </ScrollArea>
    </div>
  );
}
