"use client";
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { usePathname } from "next/navigation";

export const NavLink = ({ icon, text, baseSlug, slug }: { icon: React.ReactNode; text: string; baseSlug: string; slug: string }) => {
  const pathname = usePathname();
  const href = `/whatsapp/${baseSlug}/${slug}`;
  const isActive = pathname === href;
  const activeClass = "bg-accent text-accent-foreground dark:hover:bg-input/50";
  return (
    <Button variant="outline" asChild aria-current={isActive ? "page" : undefined}
      className={isActive ? activeClass : undefined}
    >
      <Link href={href} aria-current={isActive ? "page" : undefined} >
        {icon} {text}
      </Link>
    </Button>
  )
}