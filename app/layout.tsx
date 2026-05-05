import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Navva",
  description: "Trabaja mejor. Gana más. Vive con libertad.",
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
