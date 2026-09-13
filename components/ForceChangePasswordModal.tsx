"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, ShieldAlert, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LogoutDialog } from "@/components/LogoutDialog";

export function ForceChangePasswordModal() {
  const { user, member, updateUserPassword } = useAuth();
  const { toast } = useToast();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  // Only show modal if user is logged in and member has needsPasswordChange set to true
  const isOpen = !!(user && member?.needsPasswordChange);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newPassword || newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword === "CHECKMATE") {
      setError("Please choose a new password different from the default password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setIsSubmitting(true);
    const err = await updateUserPassword(newPassword);
    setIsSubmitting(false);

    if (err) {
      setError(err);
    } else {
      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully! Welcome to the portal.",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={() => {}}>
        <DialogContent 
          className="max-w-md [&>button]:hidden z-[80]" 
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="flex justify-end">
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowLogoutDialog(true)}
              className="text-xs text-muted-foreground hover:text-destructive gap-1 px-2 h-7"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log Out</span>
            </Button>
          </div>

          <DialogHeader className="pt-0">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-2">
              <KeyRound className="h-6 w-6 text-amber-500" />
            </div>
            <DialogTitle className="text-center text-xl">First Time Login - Set Password</DialogTitle>
            <DialogDescription className="text-center">
              Welcome, <span className="font-semibold text-foreground">{member?.name}</span>! For account security, please set your personal password before continuing.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password (min 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter className="pt-2 flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setShowLogoutDialog(true)} className="w-full sm:w-auto text-xs border-border">
                Log Out Instead
              </Button>
              <Button type="submit" className="w-full sm:w-auto flex-1" disabled={isSubmitting}>
                {isSubmitting ? "Updating Password..." : "Set Password & Continue"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <LogoutDialog isOpen={showLogoutDialog} onClose={() => setShowLogoutDialog(false)} />
    </>
  );
}

