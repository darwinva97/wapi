import { Suspense } from "react";
import { requirePlatformAdmin } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { AdminSidebar } from "./admin-sidebar";

async function AdminLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await requirePlatformAdmin();
  } catch {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <AdminSidebar userName={user.name} userEmail={user.email} />

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="px-12 py-8">{children}</div>
      </main>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}
