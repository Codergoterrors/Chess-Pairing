"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/navbar";

export function NavbarWrapper() {
  const { user, isLoading } = useAuth();

  // Don't show navbar if not logged in or during initial loading
  if (isLoading || !user) return null;

  return <Navbar />;
}

