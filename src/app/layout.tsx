import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "HRD.ai — Simulasi Interview",
  description: "Latihan interview dengan AI sebagai HRD perusahaan pilihanmu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}