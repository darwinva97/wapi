import { auth } from "@/lib/auth";
import { db } from "@/db";
import { whatsappTable } from "@/db/schema";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { createConnectionAction } from "./actions";

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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Nueva Conexión para {wa.name}
          </h1>
        </div>
      </header>
      <main>
        <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
          <div className="md:grid md:grid-cols-3 md:gap-6">
            <div className="md:col-span-1">
              <div className="px-4 sm:px-0">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Información de la Conexión</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Configura cómo interactuará esta conexión con tu cuenta de WhatsApp.
                </p>
              </div>
            </div>
            <div className="mt-5 md:col-span-2 md:mt-0">
              <form action={createConnectionAction}>
                <input type="hidden" name="whatsappSlug" value={wa.slug} />
                <div className="shadow sm:overflow-hidden sm:rounded-md">
                  <div className="space-y-6 bg-white px-4 py-5 sm:p-6">
                    <div className="grid grid-cols-6 gap-6">
                      <div className="col-span-6 sm:col-span-4">
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                          Nombre
                        </label>
                        <input
                          type="text"
                          name="name"
                          id="name"
                          required
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-black border p-2"
                        />
                      </div>

                      <div className="col-span-6 sm:col-span-4">
                        <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
                          Slug (Identificador único)
                        </label>
                        <input
                          type="text"
                          name="slug"
                          id="slug"
                          required
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-black border p-2"
                        />
                        <p className="mt-2 text-sm text-gray-500">
                          Se usará en la URL. Debe ser único.
                        </p>
                      </div>

                      <div className="col-span-6">
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                          Descripción
                        </label>
                        <div className="mt-1">
                          <textarea
                            id="description"
                            name="description"
                            rows={3}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-black border p-2"
                            placeholder="Para qué sirve esta conexión..."
                          />
                        </div>
                      </div>

                      <div className="col-span-6">
                        <fieldset>
                          <legend className="sr-only">Opciones</legend>
                          <div className="text-base font-medium text-gray-900" aria-hidden="true">Opciones</div>
                          <div className="mt-4 space-y-4">
                            <div className="flex items-start">
                              <div className="flex h-5 items-center">
                                <input
                                  id="receiverEnabled"
                                  name="receiverEnabled"
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              </div>
                              <div className="ml-3 text-sm">
                                <label htmlFor="receiverEnabled" className="font-medium text-gray-700">Habilitar Receiver</label>
                                <p className="text-gray-500">Permite recibir mensajes y eventos de WhatsApp (Webhooks).</p>
                              </div>
                            </div>
                            <div className="flex items-start">
                              <div className="flex h-5 items-center">
                                <input
                                  id="senderEnabled"
                                  name="senderEnabled"
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              </div>
                              <div className="ml-3 text-sm">
                                <label htmlFor="senderEnabled" className="font-medium text-gray-700">Habilitar Sender</label>
                                <p className="text-gray-500">Permite enviar mensajes a través de la API.</p>
                              </div>
                            </div>
                          </div>
                        </fieldset>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 text-right sm:px-6">
                    <Link
                      href={`/whatsapp/${wa.slug}`}
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 mr-3"
                    >
                      Cancelar
                    </Link>
                    <button
                      type="submit"
                      className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      Crear Conexión
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
