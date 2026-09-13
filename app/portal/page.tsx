"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck, UserPlus, Pencil, Trash2, KeyRound, Crown, Award, Users, UserCheck } from "lucide-react";
import { ClubMember, ClubRole, ClubPermission } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

const ROLE_OPTIONS: { role: ClubRole; label: string; defaultDesignation: string; permissions: ClubPermission[] }[] = [
  {
    role: "president_chief_arbiter",
    label: "President & Chief Arbiter",
    defaultDesignation: "President & Chief Arbiter",
    permissions: ["manage_members", "manage_tournaments", "manage_players", "manage_pairings", "enter_results", "verify_attendance"],
  },
  {
    role: "vice_president",
    label: "Vice President",
    defaultDesignation: "Vice President",
    permissions: ["manage_tournaments", "manage_players", "manage_pairings", "enter_results", "verify_attendance"],
  },
  {
    role: "chief_arbiter",
    label: "Chief Arbiter",
    defaultDesignation: "Chief Arbiter",
    permissions: ["manage_tournaments", "manage_pairings", "enter_results", "verify_attendance"],
  },
  {
    role: "arbiter",
    label: "Arbiter / Deputy Arbiter",
    defaultDesignation: "Arbiter",
    permissions: ["manage_pairings", "enter_results", "verify_attendance"],
  },
  {
    role: "organizer",
    label: "Event Organizer",
    defaultDesignation: "Event Organizer",
    permissions: ["manage_players", "verify_attendance"],
  },
  {
    role: "member",
    label: "Club Member / Volunteer",
    defaultDesignation: "Club Member",
    permissions: ["verify_attendance"],
  },
];

const ALL_PERMISSIONS: { id: ClubPermission; label: string; desc: string }[] = [
  { id: "manage_members", label: "Manage Club Members", desc: "Add, edit, or remove portal user access and roles" },
  { id: "manage_tournaments", label: "Manage Tournaments", desc: "Create, edit, or delete chess tournaments" },
  { id: "manage_players", label: "Manage Player Roster", desc: "Add, edit, or import tournament player database" },
  { id: "manage_pairings", label: "Manage Pairings", desc: "Generate round pairings and edit match brackets" },
  { id: "enter_results", label: "Enter Match Scores", desc: "Submit game outcomes (Win / Loss / Draw / Bye)" },
  { id: "verify_attendance", label: "Verify Attendance", desc: "Mark player presence and approve verification OTPs" },
];

export default function PortalPage() {
  const { member, isSuperAdmin, isPresident, canManageMembers, members, addMember, updateMember, deleteMember } = useAuth();
  const { toast } = useToast();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<ClubMember | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ClubRole>("arbiter");
  const [designation, setDesignation] = useState("Arbiter");
  const [selectedPermissions, setSelectedPermissions] = useState<ClubPermission[]>([
    "manage_pairings",
    "enter_results",
    "verify_attendance",
  ]);
  const [isActive, setIsActive] = useState(true);

  const openAdd = () => {
    setEditingMember(null);
    setName("");
    setEmail("");
    setRole("arbiter");
    setDesignation("Arbiter");
    setSelectedPermissions(["manage_pairings", "enter_results", "verify_attendance"]);
    setIsActive(true);
    setShowAddDialog(true);
  };

  const openEdit = (m: ClubMember) => {
    if (!isPresident) {
      toast({
        title: "Access Restricted",
        description: "Only the President can edit existing club members and their roles.",
        variant: "destructive",
      });
      return;
    }
    setEditingMember(m);
    setName(m.name);
    setEmail(m.email);
    setRole(m.role);
    setDesignation(m.designation);
    setSelectedPermissions(m.permissions || []);
    setIsActive(m.isActive);
    setShowAddDialog(true);
  };

  const handleRoleChange = (newRole: ClubRole) => {
    setRole(newRole);
    const matched = ROLE_OPTIONS.find((r) => r.role === newRole);
    if (matched) {
      setDesignation(matched.defaultDesignation);
      setSelectedPermissions(matched.permissions);
    }
  };

  const handlePermissionToggle = (perm: ClubPermission) => {
    if (selectedPermissions.includes(perm)) {
      setSelectedPermissions(selectedPermissions.filter((p) => p !== perm));
    } else {
      setSelectedPermissions([...selectedPermissions, perm]);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      toast({ title: "Valid email is required", variant: "destructive" });
      return;
    }

    if (editingMember) {
      if (!isPresident) {
        toast({ title: "Only the President can modify existing member details", variant: "destructive" });
        return;
      }
      await updateMember({
        ...editingMember,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        designation: designation.trim() || "Club Member",
        permissions: selectedPermissions,
        isActive,
      });
      toast({ title: "Member updated successfully!" });
    } else {
      await addMember({
        id: crypto.randomUUID(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: isPresident ? role : "member",
        designation: isPresident ? (designation.trim() || "Club Member") : "Club Member",
        permissions: isPresident ? selectedPermissions : ["verify_attendance"],
        isActive,
        needsPasswordChange: true,
      });
      toast({ title: "New club member added!" });
    }

    setShowAddDialog(false);
  };

  const handleDelete = async (id: string, mName: string) => {
    if (!isPresident) {
      toast({ title: "Only the President can remove club members", variant: "destructive" });
      return;
    }
    if (id === member?.id || mName === "Omkar Bhagat") {
      toast({ title: "Cannot delete President account", variant: "destructive" });
      return;
    }
    if (!confirm(`Are you sure you want to remove access for "${mName}"?`)) return;
    await deleteMember(id);
    toast({ title: `${mName} access removed.` });
  };

  if (!canManageMembers) {
    return (
      <div className="container mx-auto py-12 text-center">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <CardTitle>Restricted Access</CardTitle>
            <CardDescription>Only designated Club Committee Members can access the Club Portal.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight">Checkmate Club Portal</h1>
            <Badge className="bg-primary/20 text-primary border-primary/30 gap-1 px-3 py-1">
              <Crown className="h-3.5 w-3.5 text-amber-500" /> President Control
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Manage club member designations, arbiter credentials, and portal permission controls.
          </p>
        </div>

        <Button onClick={openAdd} className="gap-2 shrink-0">
          <UserPlus className="h-4 w-4" /> Add Club Member
        </Button>
      </div>

      {/* ── Overview Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-semibold">President & Chief Arbiter</CardDescription>
            <CardTitle className="text-xl flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" /> Omkar Bhagat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Super Admin & Full Portal Control</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-semibold">Total Authorized Members</CardDescription>
            <CardTitle className="text-xl flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" /> {members.length} Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{members.filter((m) => m.isActive).length} Active credentials</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-semibold">Active Arbiters</CardDescription>
            <CardTitle className="text-xl flex items-center gap-2">
              <Award className="h-5 w-5 text-green-500" />{" "}
              {members.filter((m) => m.role.includes("arbiter")).length} Arbiters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Authorized for round pairing & scoring</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Members Table ── */}
      <Card>
        <CardHeader>
          <CardTitle>Member Access Roster</CardTitle>
          <CardDescription>All club members with designated access privileges to the Chess Pairing Portal</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-3 px-3 font-medium">Member Name</th>
                  <th className="text-left py-3 px-3 font-medium">Email</th>
                  <th className="text-left py-3 px-3 font-medium">Designation</th>
                  <th className="text-left py-3 px-3 font-medium">Role</th>
                  <th className="text-center py-3 px-3 font-medium">Status</th>
                  <th className="text-right py-3 px-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const isPresident = m.role === "president_chief_arbiter" || m.name === "Omkar Bhagat";
                  return (
                    <tr key={m.id} className="border-b hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-3 font-semibold text-foreground flex items-center gap-2">
                        {isPresident ? <Crown className="h-4 w-4 text-amber-500 shrink-0" /> : <UserCheck className="h-4 w-4 text-blue-500 shrink-0" />}
                        {m.name}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">{m.email}</td>
                      <td className="py-3 px-3 font-medium">{m.designation}</td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className={isPresident ? "bg-amber-500/10 text-amber-600 border-amber-500/30" : "bg-blue-500/10 text-blue-600 border-blue-500/30"}>
                          {ROLE_OPTIONS.find((r) => r.role === m.role)?.label || m.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {m.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-green-500/15 text-green-600 font-medium border border-green-500/30">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-600 font-medium border border-red-500/30">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit member permissions" onClick={() => openEdit(m)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!isPresident && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Remove member" onClick={() => handleDelete(m.id, m.name)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── ADD / EDIT DIALOG ── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMember ? "Edit Club Member Access" : "Add New Club Member"}</DialogTitle>
            <DialogDescription>Assign role, designation, and portal permissions.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Member Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Sharma" />
              </div>
              <div className="space-y-1">
                <Label>Email Address *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. rahul@example.com" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Club Role</Label>
                <Select value={role} onValueChange={(v) => handleRoleChange(v as ClubRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.role} value={r.role}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Official Designation</Label>
                <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Deputy Arbiter" />
              </div>
            </div>

            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">Portal Permissions</Label>
              <div className="grid grid-cols-1 gap-2 border rounded-lg p-3 max-h-48 overflow-y-auto">
                {ALL_PERMISSIONS.map((perm) => (
                  <div key={perm.id} className="flex items-start space-x-2.5">
                    <Checkbox
                      id={perm.id}
                      checked={selectedPermissions.includes(perm.id)}
                      onCheckedChange={() => handlePermissionToggle(perm.id)}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <label htmlFor={perm.id} className="text-xs font-semibold cursor-pointer">
                        {perm.label}
                      </label>
                      <p className="text-[11px] text-muted-foreground">{perm.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <div>
                <p className="text-xs font-semibold">Account Status</p>
                <p className="text-[11px] text-muted-foreground">Enable or temporarily revoke portal access</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>{editingMember ? "Save Changes" : "Add Member"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
