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
  isPresident: boolean;
  canManageMembers: boolean;
  hasPermission: (permission: ClubPermission) => boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  updateUserPassword: (newPassword: string) => Promise<string | null>;
  members: ClubMember[];
  addMember: (member: Omit<ClubMember, "createdAt">) => Promise<void>;
  updateMember: (member: ClubMember) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
}

const DEFAULT_SUPER_ADMIN: ClubMember = {
  id: "omkar-president-id",
  email: "omkar.bhagatt@gmail.com",
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

const DEFAULT_VICE_PRESIDENT: ClubMember = {
  id: "ce228665-28fb-4b0a-889c-0043a3c370c0",
  email: "adityashinde9551@gmail.com",
  name: "Aditya Shinde",
  role: "vice_president",
  designation: "Vice President & Senior Arbiter",
  permissions: [
    "manage_players",
    "manage_pairings",
    "enter_results",
    "verify_attendance",
  ],
  isActive: true,
  needsPasswordChange: true,
  createdAt: Date.now(),
};

const INITIAL_MEMBERS = [DEFAULT_SUPER_ADMIN, DEFAULT_VICE_PRESIDENT];

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  member: null,
  isLoading: true,
  isSuperAdmin: false,
  isPresident: false,
  canManageMembers: false,
  hasPermission: () => false,
  signIn: async () => null,
  signOut: async () => {},
  updateUserPassword: async () => null,
  members: [],
  addMember: async () => {},
  updateMember: async () => {},
  deleteMember: async () => {},
});

const STORAGE_KEY = "chess_club_members_v2";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<ClubMember | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load members list from localStorage or initialize with defaults
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: ClubMember[] = JSON.parse(stored);
        // Ensure Omkar and Aditya exist
        const hasAditya = parsed.some(m => m.email.toLowerCase() === DEFAULT_VICE_PRESIDENT.email.toLowerCase());
        const hasOmkar = parsed.some(m => m.email.toLowerCase() === DEFAULT_SUPER_ADMIN.email.toLowerCase() || m.name === "Omkar Bhagat");
        let list = parsed;
        if (!hasAditya) list = [...list, DEFAULT_VICE_PRESIDENT];
        if (!hasOmkar) list = [DEFAULT_SUPER_ADMIN, ...list];
        setMembers(list);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MEMBERS));
        setMembers(INITIAL_MEMBERS);
      }
    } catch {
      setMembers(INITIAL_MEMBERS);
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
      // Match by exact email or fallback
      const matched = members.find(m => m.email.toLowerCase().trim() === email);
      if (matched) {
        setMember(matched);
      } else {
        const isOmkar = email.includes("omkar") || email === DEFAULT_SUPER_ADMIN.email.toLowerCase();
        const isAditya = email === DEFAULT_VICE_PRESIDENT.email.toLowerCase();
        if (isOmkar) {
          setMember({ ...DEFAULT_SUPER_ADMIN, email: email || DEFAULT_SUPER_ADMIN.email });
        } else if (isAditya) {
          setMember(DEFAULT_VICE_PRESIDENT);
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

  const isPresident = member?.role === "president_chief_arbiter" || member?.email?.toLowerCase().includes("omkar") || false;
  const isSuperAdmin = isPresident;
  const canManageMembers = isPresident || member?.role === "vice_president";

  const hasPermission = (permission: ClubPermission): boolean => {
    if (isPresident) return true;
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

  const updateUserPassword = async (newPassword: string): Promise<string | null> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return error.message;

    // Clear needsPasswordChange flag for current member
    if (member) {
      const updatedMem: ClubMember = { ...member, needsPasswordChange: false };
      setMember(updatedMem);
      const updatedList = members.map(m => m.id === member.id || m.email.toLowerCase() === member.email.toLowerCase() ? updatedMem : m);
      saveMembers(updatedList);
    }
    return null;
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
      user, session, member, isLoading, isSuperAdmin, isPresident, canManageMembers, hasPermission,
      signIn, signOut, updateUserPassword, members, addMember, updateMember, deleteMember
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);


