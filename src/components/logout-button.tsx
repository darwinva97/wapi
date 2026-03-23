"use client";

import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-full"
      onClick={handleLogout}
    >
      <LogOut className="mr-2 h-4 w-4" />
      Cerrar sesión
    </Button>
  );
}
