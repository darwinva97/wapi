import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { updateWhatsappAction } from "./actions";
import { DeleteWhatsappButton } from "./delete-whatsapp-button";
import { getWhatsappBySlugWithRole } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function EditWhatsappPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Require at least manager role to edit, get actual role for delete button visibility
  const { wa, role } = await getWhatsappBySlugWithRole(slug, "manager");

  const isOwner = role === "owner";

  async function updateAction(formData: FormData) {
    "use server";
    await updateWhatsappAction(wa!.id, formData);
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-xl space-y-6 p-6">
        {/* Edit Form Card */}
        <Card>
          <CardHeader>
            <CardTitle className="font-mono">Editar WhatsApp</CardTitle>
            <CardDescription>{wa.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateAction} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="slug">
                  Slug <span className="text-muted-foreground">(Identificador unico)</span>
                </Label>
                <Input
                  id="slug"
                  name="slug"
                  type="text"
                  required
                  defaultValue={wa.slug}
                />
                <p className="text-xs text-muted-foreground">
                  Identificador unico para la API.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripcion</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={wa.description || ""}
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-full"
                  asChild
                >
                  <Link href={`/whatsapp/${wa.slug}`}>Cancelar</Link>
                </Button>
                <Button type="submit" className="flex-1 rounded-full">
                  Guardar cambios
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        {isOwner && (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive font-mono text-base">
                Zona de peligro
              </CardTitle>
              <CardDescription>
                Una vez eliminada, la instancia no podra ser recuperada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeleteWhatsappButton slug={wa.slug} name={wa.name} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
