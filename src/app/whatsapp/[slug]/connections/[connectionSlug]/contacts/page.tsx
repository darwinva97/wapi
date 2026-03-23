import { db } from "@/db";
import { whatsappTable, contactTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function ContactsPage({ params }: { params: Promise<{ slug: string; connectionSlug: string }> }) {
  const { slug } = await params;

  const whatsapp = await db.query.whatsappTable.findFirst({
    where: eq(whatsappTable.slug, slug),
  });

  if (!whatsapp) return notFound();

  const contacts = await db.query.contactTable.findMany({
    where: eq(contactTable.whatsappId, whatsapp.id),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Contacts ({contacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Push Name</TableHead>
                <TableHead>Phone / LID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No contacts found.
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>{contact.name}</TableCell>
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
  );
}
