"use client";

import { useState, useMemo } from "react";
import { useChessData } from "@/hooks/useChessData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, Search } from "lucide-react";
import { Player } from "@/lib/types";

const BRANCHES = ["CE", "CSE CySec", "CSE AIML", "IT", "ENTC", "ME", "Civil", "Other"];

const emptyForm = (): Partial<Player> => ({
  name: "", rollNo: "", branch: "CE", year: "", isRated: false,
  officialElo: undefined, fideRating: undefined, estimatedElo: undefined,
});

export default function PlayersPage() {
  const { toast } = useToast();
  const { players, standings, addPlayer, updatePlayer, deletePlayer } = useChessData();

  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [form, setForm] = useState<Partial<Player>>(emptyForm());

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

  const filtered = useMemo(() =>
    players.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.rollNo.toLowerCase().includes(search.toLowerCase()) ||
      p.branch?.toLowerCase().includes(search.toLowerCase())
    ), [players, search]);

  const getElo = (p: Player) =>
    p.officialElo ?? p.fideRating ?? p.estimatedElo ?? null;

  const openAdd = () => {
    setEditingPlayer(null);
    setForm(emptyForm());
    setShowDialog(true);
  };

  const openEdit = (p: Player) => {
    setEditingPlayer(p);
    setForm({ ...p });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name?.trim() || !form.rollNo?.trim()) {
      toast({ title: "Name and Roll No are required", variant: "destructive" });
      return;
    }

    if (editingPlayer) {
      await updatePlayer({ ...editingPlayer, ...form } as Player);
      toast({ title: "Player updated!" });
    } else {
      await addPlayer({
        ...form,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      } as Player);
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Player Management</h1>
          <p className="text-muted-foreground mt-1">Manage chess tournament players</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" /> Add Player
        </Button>
      </div>

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
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No players found</td></tr>
                )}
                {filtered.map(p => {
                  const elo = getElo(p);
                  const stats = playerStats.get(p.id);
                  return (
                    <tr key={p.id} className="border-b hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-2 font-semibold">{p.name}</td>
                      <td className="py-3 px-2 text-muted-foreground">{p.rollNo}</td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="text-xs">{p.branch}</Badge>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground text-xs">{(p as any).year || "—"}</td>
                      <td className="py-3 px-2 text-muted-foreground text-xs">{(p as any).division || "—"}</td>
                      <td className="py-3 px-2 text-right font-semibold">
                        {elo ? elo : <span className="text-muted-foreground text-xs">NR</span>}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="text-green-500 font-semibold">{stats?.wins ?? 0}W</span>
                        <span className="text-muted-foreground"> / </span>
                        <span className="text-red-500 font-semibold">{stats?.losses ?? 0}L</span>
                        <span className="text-muted-foreground"> / </span>
                        <span className="text-blue-500 font-semibold">{stats?.draws ?? 0}D</span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleDelete(p.id, p.name)}>
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

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={o => !o && setShowDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPlayer ? "Edit Player" : "Add New Player"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input value={form.name ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
              </div>
              <div className="space-y-1">
                <Label>Roll No *</Label>
                <Input value={form.rollNo ?? ""} onChange={e => setForm(f => ({ ...f, rollNo: e.target.value }))} placeholder="e.g. DW236" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Branch</Label>
                <Select value={form.branch ?? "CE"} onValueChange={v => setForm(f => ({ ...f, branch: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Class / Year</Label>
                <Input value={form.year ?? ""} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} placeholder="e.g. FY, SY, TY" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Division</Label>
              <Input value={(form as any).division ?? ""} onChange={e => setForm(f => ({ ...f, division: e.target.value } as any))} placeholder="e.g. SA1, FA4, DW2" />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-sm">Rated Player</p>
                <p className="text-xs text-muted-foreground">Has an official chess rating</p>
              </div>
              <Switch
                checked={form.isRated ?? false}
                onCheckedChange={v => setForm(f => ({ ...f, isRated: v }))}
              />
            </div>

            {form.isRated && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Official Elo</Label>
                  <Input
                    type="number"
                    value={form.officialElo ?? ""}
                    onChange={e => setForm(f => ({ ...f, officialElo: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="e.g. 1200"
                  />
                </div>
                <div className="space-y-1">
                  <Label>FIDE Rating</Label>
                  <Input
                    type="number"
                    value={form.fideRating ?? ""}
                    onChange={e => setForm(f => ({ ...f, fideRating: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="e.g. 1500"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingPlayer ? "Save Changes" : "Add Player"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}