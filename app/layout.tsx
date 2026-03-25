import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { NavbarWrapper } from "@/components/NavbarWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chess Pairing",
  description: "Chess tournament pairing and management system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <AuthProvider>
          <NavbarWrapper />
          <main>{children}</main>
          <footer className="border-t py-4 mt-8">
            <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
              Developed by Osm Omkar{" "}
              <a href="https://www.instagram.com/osmomkar_" target="_blank" rel="noreferrer"
                className="text-pink-500 hover:underline ml-1">Instagram</a>
            </div>
          </footer>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
