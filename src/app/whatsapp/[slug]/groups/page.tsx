import { db } from "@/db";
import { groupTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { getWAFromSlugUserIdCache } from "../cache";

export default async function GroupsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const whatsapp = await getWAFromSlugUserIdCache({ slug, userId: session.user.id });

  if (!whatsapp) return notFound();

  const groups = await db.query.groupTable.findMany({
    where: eq(groupTable.whatsappId, whatsapp.id),
  });

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-mono">Grupos ({groups.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripcion</TableHead>
                  <TableHead>GID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No hay grupos.
                    </TableCell>
                  </TableRow>
                ) : (
                  groups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/whatsapp/${slug}/chats/${encodeURIComponent(group.gid)}`}
                          className="text-primary hover:underline"
                        >
                          {group.name}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {group.description || <span className="text-muted-foreground">Sin descripcion</span>}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs font-mono text-muted-foreground">{group.gid}</code>
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
