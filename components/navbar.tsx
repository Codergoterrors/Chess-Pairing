"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import clubLogo from "@/public/club-logo.jpg";

export function Navbar() {
  const router = useRouter();
  const { user, member, isSuperAdmin, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  const displayName = member?.name || user?.email?.split("@")[0] || "Omkar";
  const firstName = displayName.split(" ")[0];

  return (
    <nav className="border-b bg-background sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="relative h-9 w-9 overflow-hidden rounded-lg border border-amber-500/40 shadow-sm flex-shrink-0">
            <Image
              src={clubLogo}
              alt="Checkmate | Chess Club"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div className="flex flex-col">
            <span className="text-foreground font-extrabold tracking-tight text-base leading-tight">Checkmate | Chess Club</span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/players">
            <Button variant="ghost" size="sm">Players</Button>
          </Link>
          <Link href="/tournaments">
            <Button variant="ghost" size="sm">Tournaments</Button>
          </Link>
          <Link href="/manual-result">
            <Button variant="ghost" size="sm">Manual Result</Button>
          </Link>

          {isSuperAdmin && (
            <Link href="/portal">
              <Button variant="outline" size="sm" className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10">
                <ShieldCheck className="h-4 w-4" />
                <span>Club Portal</span>
              </Button>
            </Link>
          )}

          {user && (
            <div className="flex items-center gap-3 border-l pl-4 ml-1">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-sm font-semibold text-foreground">
                  Hey, {firstName} 👋
                </span>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {member?.designation || "President & Chief Arbiter"}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1 text-muted-foreground hover:text-destructive">
                <LogOut className="h-4 w-4" />
                <span className="hidden md:inline">Logout</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
