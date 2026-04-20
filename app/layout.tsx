import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Juanfer OS",
  description: "Sistema de productividad personal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
