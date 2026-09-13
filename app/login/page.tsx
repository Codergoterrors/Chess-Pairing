"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Instagram } from "lucide-react";
import Image from "next/image";
import clubLogo from "@/public/club-logo.jpg";

export default function LoginPage() {
  const { user, isLoading, signIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/");
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSigningIn(true);
    const errorMsg = await signIn(email, password);
    if (errorMsg) {
      setError("Invalid email or password. Please try again.");
      setIsSigningIn(false);
    } else {
      router.replace("/");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo & Branding */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-28 w-28 overflow-hidden rounded-2xl border-2 border-amber-500/40 shadow-lg">
            <Image
              src={clubLogo}
              alt="Checkmate | Chess Club"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-extrabold tracking-tight">Checkmate | Chess Club</h1>
            <p className="text-xs text-muted-foreground mt-2">Sign in to manage your tournaments</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSigningIn}>
            {isSigningIn ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span>Developed by Osm Omkar</span>
          <span>·</span>
          <a
            href="https://www.instagram.com/checkmate_chess_club_ghristu/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-pink-500 hover:text-pink-400 transition-colors"
          >
            <Instagram className="h-3.5 w-3.5" />
            Instagram
          </a>
        </div>
      </div>
    </div>
  );
}
