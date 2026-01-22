"use client";

import { SocketProvider } from "@/components/providers/socket-provider";

export function ClientLayout({
  children,
  whatsappId
}: {
  children: React.ReactNode;
  whatsappId: string;
}) {
  return (
    <SocketProvider>
      {children}
    </SocketProvider>
  );
}
