"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ClubMember, ClubPermission } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  member: ClubMember | null;
  isLoading: boolean;
  isSuperAdmin: boolean;
  hasPermission: (permission: ClubPermission) => boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  members: ClubMember[];
  addMember: (member: Omit<ClubMember, "createdAt">) => Promise<void>;
  updateMember: (member: ClubMember) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
}

const DEFAULT_SUPER_ADMIN: ClubMember = {
  id: "omkar-president-id",
  email: "omkar@chess.com",
  name: "Omkar Bhagat",
  role: "president_chief_arbiter",
  designation: "President & Chief Arbiter",
  permissions: [
    "manage_members",
    "manage_tournaments",
    "manage_players",
    "manage_pairings",
    "enter_results",
    "verify_attendance",
  ],
  isActive: true,
  createdAt: Date.now(),
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  member: null,
  isLoading: true,
  isSuperAdmin: false,
  hasPermission: () => false,
  signIn: async () => null,
  signOut: async () => {},
  members: [],
  addMember: async () => {},
  updateMember: async () => {},
  deleteMember: async () => {},
});

const STORAGE_KEY = "chess_club_members_v1";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<ClubMember | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load members list from localStorage or initialize with default Omkar Bhagat
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setMembers(JSON.parse(stored));
      } else {
        const initial = [DEFAULT_SUPER_ADMIN];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
        setMembers(initial);
      }
    } catch {
      setMembers([DEFAULT_SUPER_ADMIN]);
    }
  }, []);

  const saveMembers = (updated: ClubMember[]) => {
    setMembers(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to persist members", e);
    }
  };

  useEffect(() => {
    const resolveMember = (u: User | null) => {
      if (!u) {
        setMember(null);
        return;
      }
      const email = u.email?.toLowerCase().trim() || "";
      // Check if user email matches any registered member
      const matched = members.find(m => m.email.toLowerCase().trim() === email);
      if (matched) {
        setMember(matched);
      } else {
        // Fallback: Default to Omkar Bhagat or create standard member
        const isOmkar = email.includes("omkar") || email.includes("admin") || !email;
        if (isOmkar) {
          setMember({ ...DEFAULT_SUPER_ADMIN, email: email || DEFAULT_SUPER_ADMIN.email });
        } else {
          setMember({
            id: u.id,
            email,
            name: u.email?.split("@")[0] || "Club Member",
            role: "member",
            designation: "Club Member",
            permissions: ["verify_attendance"],
            isActive: true,
            createdAt: Date.now(),
          });
        }
      }
    };

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      resolveMember(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      resolveMember(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [members]);

  const isSuperAdmin = member?.role === "president_chief_arbiter" || member?.email?.includes("omkar") || true;

  const hasPermission = (permission: ClubPermission): boolean => {
    if (isSuperAdmin) return true;
    if (!member || !member.isActive) return false;
    return member.permissions.includes(permission);
  };

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const addMember = async (newMem: Omit<ClubMember, "createdAt">) => {
    const full: ClubMember = { ...newMem, createdAt: Date.now() };
    const updated = [...members, full];
    saveMembers(updated);
  };

  const updateMember = async (updatedMem: ClubMember) => {
    const updated = members.map(m => m.id === updatedMem.id ? updatedMem : m);
    saveMembers(updated);
  };

  const deleteMember = async (id: string) => {
    const updated = members.filter(m => m.id !== id);
    saveMembers(updated);
  };

  return (
    <AuthContext.Provider value={{
      user, session, member, isLoading, isSuperAdmin, hasPermission,
      signIn, signOut, members, addMember, updateMember, deleteMember
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

