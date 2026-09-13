"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, KeyRound, CheckCircle2, XCircle, Clock, ShieldCheck, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function NotificationsPage() {
  const { user, member, isPresident, notifications, approvePasswordReset, declinePasswordReset } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");

  const handleApprove = async (notifId: string, targetUserId?: string, name?: string) => {
    try {
      await approvePasswordReset(notifId, targetUserId);
      toast({
        title: "Password Reset Approved",
        description: `Approved password reset request for ${name || "member"}. They will be prompted to set a new password on login.`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Action Failed",
        description: err.message || "Failed to approve request.",
      });
    }
  };

  const handleDecline = async (notifId: string, name?: string) => {
    try {
      await declinePasswordReset(notifId);
      toast({
        title: "Request Declined",
        description: `Declined password reset request from ${name || "member"}.`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Action Failed",
        description: err.message || "Failed to decline request.",
      });
    }
  };

  // Filter relevant notifications for current user
  const userNotifs = notifications.filter(n => {
    if (isPresident && n.recipientRole === "president") return true;
    if (n.targetUserId === user?.id || n.targetUserId === member?.id) return true;
    if (n.senderId === user?.id || n.senderId === member?.id) return true;
    return false;
  });

  const passwordRequests = userNotifs.filter(n => n.type === "password_reset_request");
  const systemNotifs = userNotifs.filter(n => n.type !== "password_reset_request");

  const filteredNotifs = activeTab === "requests" ? passwordRequests : activeTab === "system" ? systemNotifs : userNotifs;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-primary">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Notification Center</h1>
            <p className="text-xs text-muted-foreground">
              Manage account alerts, password reset requests, and system updates
            </p>
          </div>
        </div>

        {isPresident && (
          <Badge variant="outline" className="w-fit border-amber-500/40 text-amber-500 bg-amber-500/10 px-3 py-1 gap-1.5 text-xs font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>President Approver View</span>
          </Badge>
        )}
      </div>

      <Tabs defaultValue="all" onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="all" className="gap-1.5 text-xs">
            <span>All</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.2">{userNotifs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-1.5 text-xs">
            <span>Requests</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.2">{passwordRequests.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-1.5 text-xs">
            <span>System</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.2">{systemNotifs.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-3">
          {filteredNotifs.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Bell className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-sm">No Notifications Yet</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {isPresident
                  ? "When club members request password resets or role changes, they will appear here for approval."
                  : "Notifications and password reset approval updates will appear here."}
              </p>
            </Card>
          ) : (
            filteredNotifs.map((n) => (
              <Card key={n.id} className="transition-all hover:border-primary/40">
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0 mt-0.5">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-foreground">{n.title}</h4>
                        {n.status === "pending" && (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30 gap-1 px-2 py-0.5">
                            <Clock className="h-3 w-3" />
                            <span>Pending Review</span>
                          </Badge>
                        )}
                        {n.status === "approved" && (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30 gap-1 px-2 py-0.5">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Approved</span>
                          </Badge>
                        )}
                        {n.status === "declined" && (
                          <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30 gap-1 px-2 py-0.5">
                            <XCircle className="h-3 w-3" />
                            <span>Declined</span>
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-foreground/90">{n.message}</p>

                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <span>Requested by: <strong className="text-foreground">{n.senderName}</strong> ({n.senderEmail})</span>
                        <span>·</span>
                        <span>{new Date(n.createdAt).toLocaleDateString()} at {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for President */}
                  {isPresident && n.type === "password_reset_request" && n.status === "pending" && (
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs text-destructive hover:bg-destructive/10 border-destructive/30 h-8 px-3 gap-1"
                        onClick={() => handleDecline(n.id, n.senderName)}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Decline</span>
                      </Button>

                      <Button
                        size="sm"
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 gap-1 shadow-sm"
                        onClick={() => handleApprove(n.id, n.senderId, n.senderName)}
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>Approve Reset</span>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
