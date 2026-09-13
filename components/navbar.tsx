"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { LogOut, ShieldCheck, KeyRound, Laptop, Bell, ChevronDown, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import clubLogo from "@/public/club-logo.jpg";
import { LogoutDialog } from "@/components/LogoutDialog";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { SessionsModal } from "@/components/SessionsModal";

export function Navbar() {
  const router = useRouter();
  const { user, member, canManageMembers, unreadNotificationCount } = useAuth();

  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showSessions, setShowSessions] = useState(false);

  const displayName = member?.name || user?.email?.split("@")[0] || "Omkar";
  const firstName = displayName.split(" ")[0];

  return (
    <>
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

            {canManageMembers && (
              <Link href="/portal">
                <Button variant="outline" size="sm" className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Club Portal</span>
                </Button>
              </Link>
            )}

            {user && (
              <div className="flex items-center gap-2 border-l pl-3 ml-1">
                {/* Notification Bell Icon */}
                <Link href="/notifications">
                  <Button variant="ghost" size="icon" className="relative h-9 w-9" title="Notifications">
                    <Bell className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                    {unreadNotificationCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
                        {unreadNotificationCount}
                      </span>
                    )}
                  </Button>
                </Link>

                {/* Profile Dropdown Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2 px-2 hover:bg-accent/70 transition-colors">
                      <div className="hidden md:flex flex-col text-right">
                        <span className="text-sm font-semibold text-foreground flex items-center gap-1">
                          Hey, {firstName} 👋
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {member?.designation || "Club Member"}
                        </span>
                      </div>
                      <div className="flex md:hidden items-center gap-1">
                        <User className="h-4 w-4" />
                        <ChevronDown className="h-3 w-3" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-56 z-[70]">
                    <DropdownMenuLabel className="font-normal py-2">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-semibold leading-none">{displayName}</p>
                        <p className="text-xs text-muted-foreground leading-none">{member?.email || user.email}</p>
                        <p className="text-[10px] text-primary font-medium pt-1">{member?.designation}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={() => setShowChangePassword(true)} className="gap-2 cursor-pointer">
                      <KeyRound className="h-4 w-4 text-muted-foreground" />
                      <span>Change Password</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => setShowSessions(true)} className="gap-2 cursor-pointer">
                      <Laptop className="h-4 w-4 text-muted-foreground" />
                      <span>Active Sessions</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => router.push("/notifications")} className="gap-2 cursor-pointer">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center justify-between w-full">
                        <span>Notifications</span>
                        {unreadNotificationCount > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0.2">
                            {unreadNotificationCount}
                          </Badge>
                        )}
                      </div>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem 
                      onClick={() => setShowLogoutDialog(true)} 
                      className="gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Log Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Modals */}
      <LogoutDialog isOpen={showLogoutDialog} onClose={() => setShowLogoutDialog(false)} />
      <ChangePasswordModal isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />
      <SessionsModal isOpen={showSessions} onClose={() => setShowSessions(false)} />
    </>
  );
}

