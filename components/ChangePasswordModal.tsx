"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, ShieldAlert, CheckCircle2, HelpCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { changePassword, requestPasswordReset } = useAuth();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!currentPassword) {
      setError("Please enter your current password.");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword === currentPassword) {
      setError("New password must be different from current password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setIsSubmitting(true);
    const err = await changePassword(currentPassword, newPassword);
    setIsSubmitting(false);

    if (err) {
      setError(err);
    } else {
      toast({
        title: "Password Changed Successfully",
        description: "Your account password has been updated.",
      });
      onClose();
      // Reset form state
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleForgotCurrentPassword = async () => {
    setError("");
    setIsSendingRequest(true);
    try {
      await requestPasswordReset("User requested password reset via Forgot Current Password link.");
      setRequestSent(true);
      toast({
        title: "Reset Request Sent",
        description: "A password reset request has been sent to the President. Once approved, you can set a new password on your next login.",
      });
    } catch (err: any) {
      setError(err.message || "Failed to send reset request.");
    } finally {
      setIsSendingRequest(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md z-[100]">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-2">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">Change Account Password</DialogTitle>
          <DialogDescription className="text-center">
            Enter your current password and set a new password for your account.
          </DialogDescription>
        </DialogHeader>

        {requestSent ? (
          <div className="py-6 text-center space-y-3">
            <div className="mx-auto w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <h4 className="font-semibold text-sm text-foreground">Request Sent to Notification Center</h4>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              The President has been notified. When approved, you will receive the password setup prompt to set your new password.
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={onClose}>
              Close Window
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="curr-password">Current Password</Label>
                <button
                  type="button"
                  onClick={handleForgotCurrentPassword}
                  disabled={isSendingRequest}
                  className="text-xs text-primary hover:underline font-medium focus:outline-none flex items-center gap-1"
                >
                  <HelpCircle className="h-3 w-3" />
                  <span>Forgot Current Password?</span>
                </button>
              </div>
              <Input
                id="curr-password"
                type="password"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-pass">New Password</Label>
              <Input
                id="new-pass"
                type="password"
                placeholder="Enter new password (min 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-pass">Confirm New Password</Label>
              <Input
                id="confirm-pass"
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

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting || isSendingRequest}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || isSendingRequest}>
                {isSubmitting ? "Updating..." : "Update Password"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
