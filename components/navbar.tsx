"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, LogOut, ShieldCheck, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

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
        <Link href="/" className="flex items-center gap-3 font-bold text-lg hover:opacity-90 transition-opacity">
          <div className="relative h-9 w-9 overflow-hidden rounded-lg border border-amber-500/40 shadow-sm bg-black/80 flex items-center justify-center">
            <img 
              src="/club-logo.png" 
              alt="Checkmate | Chess Club" 
              className="object-cover h-full w-full"
              onError={(e) => {
                // Fallback to jpg if png fails
                (e.target as HTMLImageElement).src = "/club-logo.jpg";
              }}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-foreground font-extrabold tracking-tight text-base leading-tight">Checkmate | Chess Club</span>
            <span className="text-[10px] text-amber-500 font-medium tracking-wide">GHRISTU · PUNE</span>
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
                <span className="text-sm font-semibold text-foreground flex items-center gap-1.5 justify-end">
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

