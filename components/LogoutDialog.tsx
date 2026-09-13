"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogOut, Laptop, Globe } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

interface LogoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LogoutDialog({ isOpen, onClose }: LogoutDialogProps) {
  const { signOutDevice } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async (scope: "local" | "global") => {
    setIsLoggingOut(true);
    try {
      await signOutDevice(scope);
      toast({
        title: scope === "local" ? "Logged out" : "Logged out from all devices",
        description: scope === "local" ? "You have signed out from this browser." : "All active sessions across all devices have been invalidated.",
      });
      onClose();
      router.push("/login");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Logout failed",
        description: err.message || "An error occurred during logout.",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md z-[100]">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center mb-2">
            <LogOut className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle className="text-center text-xl">Sign Out of Your Account</DialogTitle>
          <DialogDescription className="text-center">
            Choose whether to log out of this current browser session or invalidate your session on all active devices.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-12 text-left border-border hover:bg-accent"
            onClick={() => handleLogout("local")}
            disabled={isLoggingOut}
          >
            <div className="p-2 rounded-md bg-muted text-foreground">
              <Laptop className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold text-sm">Log Out of This Device</div>
              <div className="text-xs text-muted-foreground">Ends session on this browser only</div>
            </div>
          </Button>

          <Button
            variant="destructive"
            className="w-full justify-start gap-3 h-12 text-left"
            onClick={() => handleLogout("global")}
            disabled={isLoggingOut}
          >
            <div className="p-2 rounded-md bg-destructive-foreground/10 text-destructive-foreground">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold text-sm">Log Out of All Devices</div>
              <div className="text-xs opacity-90">Invalidates sessions across all browsers & phones</div>
            </div>
          </Button>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="ghost" className="w-full" onClick={onClose} disabled={isLoggingOut}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
