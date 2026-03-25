"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trophy, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function Navbar() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <nav className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity">
          <Trophy className="h-6 w-6 text-primary" />
          <span className="text-foreground">Chess Pairing</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link href="/players">
            <Button variant="ghost" size="sm">Players</Button>
          </Link>
          <Link href="/tournaments">
            <Button variant="ghost" size="sm">Tournaments</Button>
          </Link>
          <Link href="/manual-result">
            <Button variant="ghost" size="sm">Manual Result</Button>
          </Link>

          {email && (
            <>
              <span className="text-xs text-muted-foreground hidden md:block border-l pl-4">
                {email}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1 text-muted-foreground hover:text-destructive">
                <LogOut className="h-4 w-4" />
                <span className="hidden md:inline">Logout</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
