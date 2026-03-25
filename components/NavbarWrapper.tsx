"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trophy, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function NavbarWrapper() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  // Don't show navbar on login page
  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <nav className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity">
          <Trophy className="h-6 w-6 text-primary" />
          <span className="text-foreground">Chess Pairing</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link href="/players">
            <Button variant="ghost" size="sm">Players</Button>
          </Link>
          <Link href="/tournaments">
            <Button variant="ghost" size="sm">Tournaments</Button>
          </Link>
          <Link href="/manual-result">
            <Button variant="ghost" size="sm">Manual Result</Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-destructive gap-1"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  );
}
