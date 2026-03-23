import { db } from "@/db";
import { whatsappTable, contactTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function ContactsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const whatsapp = await db.query.whatsappTable.findFirst({
    where: and(
      eq(whatsappTable.slug, slug),
      eq(whatsappTable.userId, session.user.id)
    ),
  });

  if (!whatsapp) return notFound();

  const contacts = await db.query.contactTable.findMany({
    where: eq(contactTable.whatsappId, whatsapp.id),
  });

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-mono">Contactos ({contacts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Nombre</TableHead>
                  <TableHead>Push Name</TableHead>
                  <TableHead>Telefono / LID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No hay contactos.
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">{contact.name}</TableCell>
                      <TableCell>{contact.pushName}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{contact.pn}</span>
                          <span className="text-xs text-muted-foreground">{contact.lid}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
