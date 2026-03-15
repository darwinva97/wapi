import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { Geist } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "WAPI - WhatsApp API Gateway",
  description: "Dashboard y API para integrar WhatsApp en tus aplicaciones",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" >
      <body
        className={`${jetbrainsMono.variable} ${geistSans.variable} antialiased min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
