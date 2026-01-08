import { auth } from "@/lib/auth";
import { db } from "@/db";
import { whatsappTable, connectionTable } from "@/db/schema";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { updateConnectionAction } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export default async function EditConnectionView({
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

  const updateActionWithId = updateConnectionAction.bind(null, connection.id);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl">
        <form action={updateActionWithId}>
          <input type="hidden" name="whatsappSlug" value={wa.slug} />
          <Card>
            <CardHeader>
              <CardTitle>Editar Conexión: {connection.name}</CardTitle>
              <CardDescription>Actualiza los detalles de esta conexión.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" name="name" defaultValue={connection.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (Identificador único)</Label>
                <Input id="slug" name="slug" defaultValue={connection.slug} required />
                <p className="text-xs">Se usará en la URL. Debe ser único.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea id="description" name="description" defaultValue={connection.description || ''} placeholder="Para qué sirve esta conexión..." />
              </div>

              <div className="space-y-4 border p-4 rounded-md">
                <div className="flex items-center space-x-2">
                  <Checkbox id="receiverEnabled" name="receiverEnabled" defaultChecked={connection.receiverEnabled} />
                  <Label htmlFor="receiverEnabled">Habilitar Receiver</Label>
                </div>
                <p className="text-sm ml-6">Permite recibir mensajes y eventos de WhatsApp (Webhooks).</p>

                <div className="space-y-2 ml-6">
                  <Label htmlFor="receiverRequest">Configuración de Receiver (JSON)</Label>
                  <Textarea
                    id="receiverRequest"
                    name="receiverRequest"
                    rows={5}
                    defaultValue={connection.receiverRequest ? JSON.stringify(connection.receiverRequest, null, 2) : ''}
                    className="font-mono"
                    placeholder='{"url": "https://mi-api.com/webhook", "headers": {"Authorization": "Bearer ..."}}'
                  />
                  <p className="text-xs">
                    Debe ser un JSON válido con al menos una propiedad &quot;url&quot;.
                  </p>
                </div>
                <div className="space-y-2 ml-6">
                  <Label htmlFor="receiverFilter">Filtro de Receiver (JSON)</Label>
                  <Textarea
                    id="receiverFilter"
                    name="receiverFilter"
                    rows={3}
                    defaultValue={connection.receiverFilter ? JSON.stringify(connection.receiverFilter, null, 2) : ''}
                    className="font-mono"
                    placeholder='{ "fromMe": false }'
                  />
                  <p className="text-xs">
                    Opcional. JSON para filtrar qué mensajes se envían.
                  </p>
                </div>
              </div>

              <div className="space-y-4 border p-4 rounded-md">
                <div className="flex items-center space-x-2">
                  <Checkbox id="senderEnabled" name="senderEnabled" defaultChecked={connection.senderEnabled} />
                  <Label htmlFor="senderEnabled">Habilitar Sender</Label>
                </div>
                <p className="text-sm ml-6">Permite enviar mensajes a través de la API.</p>
              </div>

            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
              <Button variant="outline" asChild>
                <Link href={`/whatsapp/${wa.slug}/connections/${connection.slug}`}>Cancelar</Link>
              </Button>
              <Button type="submit">Guardar Cambios</Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  );
}
