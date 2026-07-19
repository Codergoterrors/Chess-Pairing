"use client";

import { useState, useMemo } from "react";
import { useChessData } from "@/hooks/useChessData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, Search, Upload, Eye, Trophy } from "lucide-react";
import { Player } from "@/lib/types";
import { ImportPlayersDialog } from "@/components/players/ImportPlayersDialog";

const BRANCHES = ["CE", "CSE CySec", "CSE AIML", "IT", "ENTC", "ME", "Civil", "Other"];
const PROGRAMS = ["B.Tech", "BBA", "BCA", "MBA", "B.Sc", "BCS", "B.Com", "Other"];

const emptyForm = (): Partial<Player> => ({
  name: "", rollNo: "", branch: "CE", year: "", isRated: false,
  officialElo: undefined, fideRating: undefined, estimatedElo: undefined,
  program: "", enrollmentNo: "", mobileNo: "", email: "", division: "",
});

export default function PlayersPage() {
  const { toast } = useToast();
  const { players, standings, tournaments, addPlayer, updatePlayer, deletePlayer, bulkAddPlayers } = useChessData();

  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showView, setShowView] = useState(false);
  const [viewingPlayer, setViewingPlayer] = useState<Player | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [form, setForm] = useState<Partial<Player>>(emptyForm());
  const [isCustomBranch, setIsCustomBranch] = useState(false);
  const [isCustomProgram, setIsCustomProgram] = useState(false);

  // Aggregate W/L/D across ALL tournaments for each player
  const playerStats = useMemo(() => {
    const stats = new Map<string, { wins: number; losses: number; draws: number; games: number }>();
    players.forEach(p => stats.set(p.id, { wins: 0, losses: 0, draws: 0, games: 0 }));
    standings.forEach(s => {
      const existing = stats.get(s.playerId);
      if (existing) {
        existing.wins += s.wins ?? 0;
        existing.losses += s.losses ?? 0;
        existing.draws += s.draws ?? 0;
        existing.games += s.gamesPlayed ?? 0;
      }
    });
    return stats;
  }, [players, standings]);

  // Per-player tournament history: playerId → sorted list of tournament appearances
  const playerHistory = useMemo(() => {
    const map = new Map<string, Array<{
      tournamentId: string;
      name: string;
      date?: number;
      rank: number;
      score: number;
      wins: number;
      losses: number;
      draws: number;
      buchholz: number;
    }>>();

    // For each tournament compute rank order once
    const rankMap = new Map<string, Map<string, number>>(); // tournamentId → playerId → rank
    tournaments.forEach(t => {
      const tStandings = standings
        .filter(s => s.tournamentId === t.id)
        .sort((a, b) => b.score - a.score || b.buchholz - a.buchholz);
      const rankForT = new Map<string, number>();
      tStandings.forEach((s, idx) => rankForT.set(s.playerId, idx + 1));
      rankMap.set(t.id, rankForT);
    });

    standings.forEach(s => {
      const t = tournaments.find(t => t.id === s.tournamentId);
      if (!t) return;
      const rank = rankMap.get(t.id)?.get(s.playerId) ?? 0;
      const entry = {
        tournamentId: t.id, name: t.name,
        date: t.startDate ?? t.createdAt,
        rank, score: s.score,
        wins: s.wins ?? 0, losses: s.losses ?? 0, draws: s.draws ?? 0,
        buchholz: s.buchholz ?? 0,
      };
      const arr = map.get(s.playerId) ?? [];
      arr.push(entry);
      arr.sort((a, b) => (b.date ?? 0) - (a.date ?? 0)); // newest first
      map.set(s.playerId, arr);
    });
    return map;
  }, [standings, tournaments]);

  const filtered = useMemo(() =>
    players.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.rollNo ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.branch ?? "").toLowerCase().includes(search.toLowerCase())
    ), [players, search]);

  /** Returns display info for the rating column */
  const getEloDisplay = (p: Player) => {
    const elo = p.officialElo ?? p.fideRating ?? p.estimatedElo ?? null;
    if (!elo || elo < 100) return { label: "NR", kind: "nr" as const };
    return { label: String(elo), kind: "ok" as const };
  };

  const openView = (p: Player) => { setViewingPlayer(p); setShowView(true); };

  const openAdd = () => {
    setEditingPlayer(null);
    setForm(emptyForm());
    setIsCustomBranch(false);
    setIsCustomProgram(false);
    setShowDialog(true);
  };

  const openEdit = (p: Player) => {
    setEditingPlayer(p);
    setForm({ ...p });
    setIsCustomBranch(!!p.branch && !BRANCHES.slice(0, -1).includes(p.branch as string));
    const prog = p.program ?? "";
    setIsCustomProgram(!!prog && !PROGRAMS.slice(0, -1).includes(prog));
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    // Duplicate check: same mobile OR same email already exists (name-independent)
    const mobile = form.mobileNo?.trim();
    const email  = form.email?.trim().toLowerCase();
    const duplicate = players.find(p => {
      if (editingPlayer && p.id === editingPlayer.id) return false;
      const sameMobile = mobile && p.mobileNo?.trim() && mobile === p.mobileNo.trim();
      const sameEmail  = email  && p.email?.trim()  && email  === p.email.trim().toLowerCase();
      return !!(sameMobile || sameEmail);
    });
    if (duplicate) {
      toast({
        title: "Duplicate player detected",
        description: `A player with this mobile / email already exists as "${duplicate.name}".`,
        variant: "destructive",
      });
      return;
    }

    if (editingPlayer) {
      await updatePlayer({ ...editingPlayer, ...form } as Player);
      toast({ title: "Player updated!" });
    } else {
      await addPlayer({ ...form, id: crypto.randomUUID(), createdAt: Date.now() } as Player);
      toast({ title: "Player added!" });
    }
    setShowDialog(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    await deletePlayer(id);
    toast({ title: `${name} deleted` });
  };

  return (
    <div className="container mx-auto py-10">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Player Management</h1>
          <p className="text-muted-foreground mt-1">Manage chess tournament players</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
            <Upload className="h-4 w-4" /> Import CSV / Excel
          </Button>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" /> Add Player
          </Button>
        </div>
      </div>

      {/* ── Players Table ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Registered Players ({players.length})</CardTitle>
              <CardDescription>{players.length} player(s) registered</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, roll no..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-3 px-2 font-medium">Name</th>
                  <th className="text-left py-3 px-2 font-medium">Roll No</th>
                  <th className="text-left py-3 px-2 font-medium">Branch</th>
                  <th className="text-left py-3 px-2 font-medium">Year</th>
                  <th className="text-left py-3 px-2 font-medium">Division</th>
                  <th className="text-right py-3 px-2 font-medium">Elo</th>
                  <th className="text-center py-3 px-2 font-medium">W / L / D</th>
                  <th className="text-right py-3 px-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No players found</td></tr>
                )}
                {filtered.map(p => {
                  const eloDisplay = getEloDisplay(p);
                  const stats = playerStats.get(p.id);
                  return (
                    <tr
                      key={p.id}
                      className="border-b hover:bg-secondary/30 transition-colors cursor-pointer"
                      onClick={() => openView(p)}
                    >
                      <td className="py-3 px-2 font-semibold text-primary">{p.name}</td>
                      <td className="py-3 px-2 text-muted-foreground">{p.rollNo || "—"}</td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="text-xs">{p.branch}</Badge>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground text-xs">{p.year || "—"}</td>
                      <td className="py-3 px-2 text-muted-foreground text-xs">{p.division || "—"}</td>
                      <td className="py-3 px-2 text-right font-semibold">
                        {eloDisplay.kind === "nr"
                          ? <span className="text-muted-foreground text-xs">NR</span>
                          : eloDisplay.label}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="text-green-500 font-semibold">{stats?.wins ?? 0}W</span>
                        <span className="text-muted-foreground"> / </span>
                        <span className="text-red-500 font-semibold">{stats?.losses ?? 0}L</span>
                        <span className="text-muted-foreground"> / </span>
                        <span className="text-blue-500 font-semibold">{stats?.draws ?? 0}D</span>
                      </td>
                      {/* Stop propagation so row click doesn't trigger while clicking buttons */}
                      <td className="py-3 px-2 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="View details" onClick={() => openView(p)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit player" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" title="Delete player" onClick={() => handleDelete(p.id, p.name)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* ══════════════════════════════════════════════
          VIEW Player Dialog (click on any row)
      ══════════════════════════════════════════════ */}
      <Dialog open={showView} onOpenChange={setShowView}>
        <DialogContent className="max-w-md flex flex-col" style={{ maxHeight: "90vh" }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                {viewingPlayer?.name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <p>{viewingPlayer?.name}</p>
                {(viewingPlayer?.program || viewingPlayer?.branch) && (
                  <p className="text-xs font-normal text-muted-foreground">
                    {[viewingPlayer.program, viewingPlayer.branch].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </DialogTitle>
            <DialogDescription>Full player profile</DialogDescription>
          </DialogHeader>

          {viewingPlayer && (() => {
            const stats = playerStats.get(viewingPlayer.id);
            const details = [
              { label: "Roll No",       value: viewingPlayer.rollNo    || "—" },
              { label: "Enrollment No.", value: viewingPlayer.enrollmentNo || "—" },
              { label: "Branch",        value: viewingPlayer.branch    || "—" },
              { label: "Year / Class",  value: viewingPlayer.year      || "—" },
              { label: "Division",      value: viewingPlayer.division  || "—" },
              { label: "Program",       value: viewingPlayer.program   || "—" },
              { label: "Mobile No.",    value: viewingPlayer.mobileNo  || "—" },
              { label: "Email",         value: viewingPlayer.email     || "—" },
            ];
            const ratings = [
              { label: "Official", val: viewingPlayer.officialElo },
              { label: "FIDE",     val: viewingPlayer.fideRating },
              { label: "Estimated", val: viewingPlayer.estimatedElo },
            ];
            return (
              <div className="space-y-4 mt-1 overflow-y-auto flex-1 pr-1">
                {/* Personal details grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {details.map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-medium break-all">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Ratings */}
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">Ratings</p>
                  <div className="grid grid-cols-3 gap-2">
                    {ratings.map(({ label, val }) => (
                      <div key={label} className="bg-muted/50 rounded-lg p-2.5 text-center">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-bold text-sm">
                          {val && val >= 100
                            ? val
                            : <span className="text-muted-foreground font-normal text-xs">NR</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tournament stats */}
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">Tournament Stats</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Wins",   value: stats?.wins   ?? 0, cls: "text-green-500" },
                      { label: "Losses", value: stats?.losses ?? 0, cls: "text-red-500"   },
                      { label: "Draws",  value: stats?.draws  ?? 0, cls: "text-blue-500"  },
                      { label: "Games",  value: stats?.games  ?? 0, cls: "text-foreground" },
                    ].map(({ label, value, cls }) => (
                      <div key={label} className="bg-muted/50 rounded-lg p-2.5 text-center">
                        <p className={`font-bold text-sm ${cls}`}>{value}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tournament History */}
                {(() => {
                  const history = playerHistory.get(viewingPlayer.id) ?? [];
                  if (history.length === 0) return null;
                  const rankLabel = (r: number) =>
                    r === 1 ? "🥇 1st" : r === 2 ? "🥈 2nd" : r === 3 ? "🥉 3rd" : `#${r}`;
                  return (
                    <div className="border-t pt-3">
                      <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium flex items-center gap-1">
                        <Trophy className="h-3 w-3" /> Tournaments Played
                      </p>
                      <div className="space-y-2">
                        {history.map(h => (
                          <div key={h.tournamentId}
                            className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium leading-tight truncate">{h.name}</p>
                                {h.date && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {new Date(h.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                  </p>
                                )}
                              </div>
                              <span className="shrink-0 text-sm font-semibold">{rankLabel(h.rank)}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs">
                              <span className="text-muted-foreground">Score <span className="font-semibold text-foreground">{h.score}</span></span>
                              <span className="text-green-500 font-medium">{h.wins}W</span>
                              <span className="text-red-500 font-medium">{h.losses}L</span>
                              <span className="text-blue-500 font-medium">{h.draws}D</span>
                              <span className="text-muted-foreground ml-auto">Buchholz {h.buchholz}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          <DialogFooter className="mt-2 shrink-0 border-t pt-3">
            <Button variant="outline" onClick={() => setShowView(false)}>Close</Button>
            <Button onClick={() => { setShowView(false); openEdit(viewingPlayer!); }}>Edit Player</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════
          ADD / EDIT Dialog
      ══════════════════════════════════════════════ */}
      <Dialog open={showDialog} onOpenChange={o => !o && setShowDialog(false)}>
        <DialogContent className="max-w-lg flex flex-col" style={{ maxHeight: "90vh" }}>
          <DialogHeader>
            <DialogTitle>{editingPlayer ? "Edit Player" : "Add New Player"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 overflow-y-auto flex-1 pr-1">

            {/* Name + Roll No */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input value={form.name ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
              </div>
              <div className="space-y-1">
                <Label>Roll No</Label>
                <Input value={form.rollNo ?? ""} onChange={e => setForm(f => ({ ...f, rollNo: e.target.value }))} placeholder="e.g. DW236" />
              </div>
            </div>

            {/* Program + Enrollment No */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Program</Label>
                <Select
                  value={isCustomProgram ? "Other" : (form.program || "")}
                  onValueChange={v => {
                    if (v === "Other") { setIsCustomProgram(true); setForm(f => ({ ...f, program: "" })); }
                    else { setIsCustomProgram(false); setForm(f => ({ ...f, program: v })); }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
                  <SelectContent>
                    {PROGRAMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                {isCustomProgram && (
                  <Input value={form.program ?? ""} onChange={e => setForm(f => ({ ...f, program: e.target.value }))} placeholder="Enter program name" className="mt-1" />
                )}
              </div>
              <div className="space-y-1">
                <Label>Enrollment No.</Label>
                <Input value={form.enrollmentNo ?? ""} onChange={e => setForm(f => ({ ...f, enrollmentNo: e.target.value }))} placeholder="e.g. 24BCE001" />
              </div>
            </div>

            {/* Branch + Class / Year */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Branch</Label>
                <Select
                  value={isCustomBranch ? "Other" : (form.branch ?? "CE")}
                  onValueChange={v => {
                    if (v === "Other") { setIsCustomBranch(true); setForm(f => ({ ...f, branch: "" })); }
                    else { setIsCustomBranch(false); setForm(f => ({ ...f, branch: v })); }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
                {isCustomBranch && (
                  <Input value={form.branch ?? ""} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))} placeholder="Enter branch name" className="mt-1" />
                )}
              </div>
              <div className="space-y-1">
                <Label>Class / Year</Label>
                <Input value={form.year ?? ""} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} placeholder="e.g. FY, SY, TY" />
              </div>
            </div>

            {/* Division + Mobile */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Division</Label>
                <Input value={form.division ?? ""} onChange={e => setForm(f => ({ ...f, division: e.target.value }))} placeholder="e.g. SA1, FA4, DW2" />
              </div>
              <div className="space-y-1">
                <Label>Mobile No.</Label>
                <Input type="tel" value={form.mobileNo ?? ""} onChange={e => setForm(f => ({ ...f, mobileNo: e.target.value }))} placeholder="e.g. 9876543210" />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="e.g. player@example.com" />
            </div>

            {/* Rated toggle */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-sm">Rated Player</p>
                <p className="text-xs text-muted-foreground">Has an official chess rating</p>
              </div>
              <Switch checked={form.isRated ?? false} onCheckedChange={v => setForm(f => ({ ...f, isRated: v }))} />
            </div>

            {form.isRated && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Official Elo</Label>
                  <Input type="number" value={form.officialElo ?? ""} onChange={e => setForm(f => ({ ...f, officialElo: e.target.value ? Number(e.target.value) : undefined }))} placeholder="e.g. 1200" />
                </div>
                <div className="space-y-1">
                  <Label>FIDE Rating</Label>
                  <Input type="number" value={form.fideRating ?? ""} onChange={e => setForm(f => ({ ...f, fideRating: e.target.value ? Number(e.target.value) : undefined }))} placeholder="e.g. 1500" />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingPlayer ? "Save Changes" : "Add Player"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════
          IMPORT Dialog
      ══════════════════════════════════════════════ */}
      <ImportPlayersDialog
        open={showImport}
        onOpenChange={setShowImport}
        onBulkImport={async (batch) => { await bulkAddPlayers(batch); }}
        onUpdatePlayer={async (id, patch) => {
          const existing = players.find(p => p.id === id);
          if (existing) await updatePlayer({ ...existing, ...patch });
        }}
        existingPlayers={players}
      />
    </div>
  );
}