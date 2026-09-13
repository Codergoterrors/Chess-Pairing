"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Laptop, ShieldCheck, LogOut, Globe, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface SessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SessionsModal({ isOpen, onClose }: SessionsModalProps) {
  const { user, member, signOutDevice } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async (scope: "local" | "global") => {
    setIsLoggingOut(true);
    try {
      await signOutDevice(scope);
      toast({
        title: scope === "local" ? "Logged Out of This Device" : "Logged Out of All Devices",
        description: scope === "local" ? "Your session on this browser has ended." : "All active sessions have been revoked.",
      });
      onClose();
      router.push("/login");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to logout session",
        description: err.message || "An error occurred.",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Detect user agent for display
  const userAgent = typeof window !== "undefined" ? window.navigator.userAgent : "";
  let browser = "Browser";
  if (userAgent.includes("Chrome")) browser = "Chrome";
  else if (userAgent.includes("Firefox")) browser = "Firefox";
  else if (userAgent.includes("Safari")) browser = "Safari";
  else if (userAgent.includes("Edg")) browser = "Edge";

  let os = "Device";
  if (userAgent.includes("Windows")) os = "Windows PC";
  else if (userAgent.includes("Mac")) os = "macOS";
  else if (userAgent.includes("Android")) os = "Android Phone";
  else if (userAgent.includes("iPhone")) os = "iPhone";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md z-[100]">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mb-2">
            <Laptop className="h-6 w-6 text-blue-500" />
          </div>
          <DialogTitle className="text-center text-xl">Active Login Sessions</DialogTitle>
          <DialogDescription className="text-center">
            Manage logged-in devices for account <span className="font-semibold text-foreground">{member?.email || user?.email}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current Session Card */}
          <div className="p-4 border rounded-xl bg-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500">
                  <Laptop className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-sm flex items-center gap-1.5">
                    <span>{browser} on {os}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                      This Device
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">Active Session · Currently Logged In</div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-destructive hover:bg-destructive/10 border-destructive/30 gap-1"
                onClick={() => handleLogout("local")}
                disabled={isLoggingOut}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log Out</span>
              </Button>
            </div>
          </div>

          {/* Security status */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              Your session is encrypted and authenticated via Supabase Auth JWT token. If you suspect unauthorized access, click below to end all active sessions instantly.
            </span>
          </div>

          {/* Global logout button */}
          <Button
            variant="destructive"
            className="w-full gap-2 text-xs"
            onClick={() => handleLogout("global")}
            disabled={isLoggingOut}
          >
            <Globe className="h-4 w-4" />
            <span>Log Out of All Devices</span>
          </Button>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="ghost" className="w-full" onClick={onClose} disabled={isLoggingOut}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
