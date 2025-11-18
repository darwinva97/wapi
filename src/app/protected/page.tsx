"use client";
import { useSession, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function ProtectedPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  if (isPending) return <div>Cargando...</div>;
  if (!session) {
    router.replace("/login");
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-2xl font-bold mb-4">Página protegida</h1>
      <p>Bienvenido, {session.user.name} ({session.user.email})</p>
      <p>Rol: {session.user.role}</p>
      <button
        className="mt-4 bg-red-600 text-white px-4 py-2 rounded"
        onClick={() => signOut()}
      >Cerrar sesión</button>
    </main>
  );
}
