"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Settings,
  Users,
  Database,
} from "lucide-react";

interface AdminSidebarProps {
  userName: string;
  userEmail: string;
}

const navItems = [
  { href: "/admin/platform", icon: Settings, label: "Configuración" },
  { href: "/admin/users", icon: Users, label: "Usuarios" },
  { href: "/admin/storage", icon: Database, label: "Almacenamiento" },
];

export function AdminSidebar({ userName, userEmail }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex w-[260px] flex-col border-r border-sidebar-border bg-sidebar">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">
          W
        </div>
        <span className="font-mono text-lg font-bold text-sidebar-primary">
          WAPI
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 p-4">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full px-4 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>

        <div className="my-3 h-px bg-sidebar-border" />

        <p className="mb-2 px-4 font-mono text-xs uppercase text-sidebar-foreground">
          Administración
        </p>

        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-full px-4 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-5 py-4">
        <p className="text-sm font-medium text-sidebar-primary">{userName}</p>
        <p className="text-xs text-sidebar-foreground">{userEmail}</p>
      </div>
    </aside>
  );
}
