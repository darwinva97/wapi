import { auth } from "@/lib/auth";
import { db } from "@/db";
import { whatsappTable, connectionTable } from "@/db/schema";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import Link from "next/link";

export default async function ConnectionDetailView({
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex items-center gap-4">
          <Link href={`/whatsapp/${wa.slug}`} className="text-gray-500 hover:text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {connection.name}
          </h1>
          <div className="flex gap-2">
             <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${connection.receiverEnabled ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
              Receiver: {connection.receiverEnabled ? 'ON' : 'OFF'}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${connection.senderEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
              Sender: {connection.senderEnabled ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      </header>
      <main>
        <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">Detalles de la Conexión</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Configuración y credenciales.</p>
              </div>
              <div>
                <Link
                  href={`/whatsapp/${wa.slug}/connections/${connection.slug}/edit`}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Editar
                </Link>
              </div>
            </div>
            <div className="border-t border-gray-200">
              <dl>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Nombre</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{connection.name}</dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Slug</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{connection.slug}</dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Descripción</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{connection.description || '-'}</dd>
                </div>
                
                {connection.senderEnabled && (
                  <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Sender Token</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-mono break-all">
                      {connection.senderToken}
                    </dd>
                  </div>
                )}

                {connection.receiverEnabled && (
                   <>
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Receiver Request Config</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        <pre className="whitespace-pre-wrap font-mono text-xs bg-gray-100 p-2 rounded">
                          {connection.receiverRequest ? JSON.stringify(connection.receiverRequest, null, 2) : 'No configurado'}
                        </pre>
                      </dd>
                    </div>
                    <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Receiver Filter</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                         <pre className="whitespace-pre-wrap font-mono text-xs bg-gray-100 p-2 rounded">
                          {connection.receiverFilter ? JSON.stringify(connection.receiverFilter, null, 2) : 'No configurado'}
                        </pre>
                      </dd>
                    </div>
                   </>
                )}
              </dl>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
