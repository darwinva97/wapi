import { db } from "@/db";
import { whatsappTable } from "@/db/schema";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { updateWhatsappAction } from "./actions";
import { DeleteWhatsappButton } from "./delete-whatsapp-button";
import { getWhatsappBySlugWithRole } from "@/lib/auth-utils";

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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Editar WhatsApp
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {wa.name}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form action={updateAction} className="space-y-6">
            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
                Slug (Identificador único)
              </label>
              <div className="mt-1">
                <input
                  id="slug"
                  name="slug"
                  type="text"
                  required
                  defaultValue={wa.slug}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Identificador único para la API.
              </p>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Descripción
              </label>
              <div className="mt-1">
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={wa.description || ""}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <Link
                href={`/whatsapp/${wa.slug}`}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Guardar cambios
              </button>
            </div>
          </form>

          {isOwner && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Zona de peligro</h3>
              <p className="text-sm text-gray-500 mb-4">
                Una vez eliminada, la instancia no podrá ser recuperada.
              </p>
              <DeleteWhatsappButton slug={wa.slug} name={wa.name} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
