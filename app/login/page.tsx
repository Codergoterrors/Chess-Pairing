"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { user, isLoading, signIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/tournaments");
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
      router.replace("/tournaments");
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
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Chess Pairing</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to manage your tournaments</p>
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

        <p className="text-center text-xs text-muted-foreground">
          Developed by Osm Omkar
        </p>
      </div>
    </div>
  );
}
