"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ClubMember, ClubPermission, AppNotification } from "@/lib/types";

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
  signOutDevice: (scope?: "local" | "global") => Promise<void>;
  updateUserPassword: (newPassword: string) => Promise<string | null>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
  requestPasswordReset: (reason?: string) => Promise<void>;
  approvePasswordReset: (notificationId: string, targetUserId?: string) => Promise<void>;
  declinePasswordReset: (notificationId: string) => Promise<void>;
  notifications: AppNotification[];
  unreadNotificationCount: number;
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
  needsPasswordChange: false, // Default false; real value comes from Supabase user_metadata
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
  signOutDevice: async () => {},
  updateUserPassword: async () => null,
  changePassword: async () => null,
  requestPasswordReset: async () => {},
  approvePasswordReset: async () => {},
  declinePasswordReset: async () => {},
  notifications: [],
  unreadNotificationCount: 0,
  members: [],
  addMember: async () => {},
  updateMember: async () => {},
  deleteMember: async () => {},
});

const STORAGE_KEY = "chess_club_members_v3";
const NOTIFICATIONS_KEY = "chess_club_notifications_v1";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<ClubMember | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load members list from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: ClubMember[] = JSON.parse(stored);
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

  // Load notifications from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_KEY);
      if (stored) {
        setNotifications(JSON.parse(stored));
      }
    } catch {
      setNotifications([]);
    }
  }, []);

  const saveNotifications = (updated: AppNotification[]) => {
    setNotifications(updated);
    try {
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to persist notifications", e);
    }
  };

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
      const isOmkar = email.includes("omkar") || email === DEFAULT_SUPER_ADMIN.email.toLowerCase();
      const isAditya = email === DEFAULT_VICE_PRESIDENT.email.toLowerCase();

      // Read needs_password_change from Supabase user_metadata
      const metaFlag = u.user_metadata?.needs_password_change;
      const needsPasswordChange = !isOmkar && (metaFlag === true || (isAditya && metaFlag !== false));

      const matched = members.find(m => m.email.toLowerCase().trim() === email);
      if (matched) {
        setMember({ ...matched, needsPasswordChange });
      } else {
        if (isOmkar) {
          setMember({ ...DEFAULT_SUPER_ADMIN, email: email || DEFAULT_SUPER_ADMIN.email, needsPasswordChange: false });
        } else if (isAditya) {
          setMember({ ...DEFAULT_VICE_PRESIDENT, needsPasswordChange });
        } else {
          setMember({
            id: u.id,
            email,
            name: u.email?.split("@")[0] || "Club Member",
            role: "member",
            designation: "Club Member",
            permissions: ["verify_attendance"],
            isActive: true,
            needsPasswordChange,
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

    // Listen for auth changes
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
    await supabase.auth.signOut({ scope: "local" });
  };

  const signOutDevice = async (scope: "local" | "global" = "local") => {
    await supabase.auth.signOut({ scope });
  };

  const updateUserPassword = async (newPassword: string): Promise<string | null> => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { needs_password_change: false },
    });
    if (error) return error.message;

    if (member) {
      const updatedMem: ClubMember = { ...member, needsPasswordChange: false };
      setMember(updatedMem);
      const updatedList = members.map(m => m.id === member.id || m.email.toLowerCase() === member.email.toLowerCase() ? updatedMem : m);
      saveMembers(updatedList);
    }
    return null;
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<string | null> => {
    if (!user || !user.email) return "User is not authenticated.";

    // Verify current password first by reauthenticating
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (authErr) {
      return "Current password is incorrect. Please check and try again.";
    }

    // Update to new password
    return await updateUserPassword(newPassword);
  };

  const requestPasswordReset = async (reason?: string) => {
    const newNotif: AppNotification = {
      id: crypto.randomUUID(),
      senderId: user?.id || member?.id || "unknown",
      senderName: member?.name || user?.email?.split("@")[0] || "Club Member",
      senderEmail: member?.email || user?.email || "",
      recipientRole: "president",
      type: "password_reset_request",
      title: "Password Reset Requested",
      message: `${member?.name || user?.email} requested a password reset. ${reason || ""}`,
      status: "pending",
      createdAt: Date.now(),
    };
    saveNotifications([newNotif, ...notifications]);
  };

  const approvePasswordReset = async (notificationId: string, targetUserId?: string) => {
    // Mark notification as approved
    const notif = notifications.find(n => n.id === notificationId);
    const updatedNotifs = notifications.map(n => n.id === notificationId ? { ...n, status: "approved" as const } : n);

    // Create confirmation notification for target user
    const responseNotif: AppNotification = {
      id: crypto.randomUUID(),
      senderId: user?.id || "omkar-president-id",
      senderName: "Omkar Bhagat (President)",
      senderEmail: "omkar.bhagatt@gmail.com",
      targetUserId: targetUserId || notif?.senderId,
      recipientRole: "member",
      type: "password_reset_approved",
      title: "Password Reset Approved!",
      message: "President Omkar Bhagat approved your password reset request. You will be prompted to set your new password on your next login.",
      status: "pending",
      createdAt: Date.now(),
    };

    saveNotifications([responseNotif, ...updatedNotifs]);

    // Also update member list needsPasswordChange flag
    const targetEmail = notif?.senderEmail;
    if (targetEmail) {
      const updatedList = members.map(m => {
        if (m.email.toLowerCase() === targetEmail.toLowerCase()) {
          return { ...m, needsPasswordChange: true };
        }
        return m;
      });
      saveMembers(updatedList);
    }
  };

  const declinePasswordReset = async (notificationId: string) => {
    const notif = notifications.find(n => n.id === notificationId);
    const updatedNotifs = notifications.map(n => n.id === notificationId ? { ...n, status: "declined" as const } : n);

    if (notif) {
      const responseNotif: AppNotification = {
        id: crypto.randomUUID(),
        senderId: user?.id || "omkar-president-id",
        senderName: "Omkar Bhagat (President)",
        senderEmail: "omkar.bhagatt@gmail.com",
        targetUserId: notif.senderId,
        recipientRole: "member",
        type: "password_reset_declined",
        title: "Password Reset Declined",
        message: "Your password reset request was reviewed and declined by the President.",
        status: "pending",
        createdAt: Date.now(),
      };
      saveNotifications([responseNotif, ...updatedNotifs]);
    } else {
      saveNotifications(updatedNotifs);
    }
  };

  const unreadNotificationCount = notifications.filter(n => {
    if (n.status !== "pending") return false;
    if (isPresident && n.recipientRole === "president") return true;
    if (n.targetUserId === user?.id || n.targetUserId === member?.id) return true;
    return false;
  }).length;

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
      signIn, signOut, signOutDevice, updateUserPassword, changePassword,
      requestPasswordReset, approvePasswordReset, declinePasswordReset,
      notifications, unreadNotificationCount, members, addMember, updateMember, deleteMember
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);



