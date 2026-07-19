"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Player } from "@/lib/types";
import { UserPlus, Search, Plus, ChevronDown, ChevronUp, X } from "lucide-react";

const BRANCHES = [
  "CE", "CSE CySec", "CSE AIML", "CSE AIDS", "CSE AI",
  "IT", "ENTC", "Civil", "Mechanical", "Other",
];

export interface NewPlayerDraft {
  name: string;
  rollNo: string;
  branch: string;
  year?: string;
  division?: string;
  program?: string;
  enrollmentNo?: string;
  mobileNo?: string;
  email?: string;
  isRated: boolean;
  officialElo?: number;
}

interface SpotEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current tournament object */
  tournament: any;
  /** All registered players in the system */
  allPlayers: Player[];
  /** currentRound of the tournament — shown in the description */
  currentRound: number;
  /** Called with IDs of selected existing players + data for brand-new players */
  onConfirm: (existingIds: string[], newPlayers: NewPlayerDraft[]) => void;
}

const blankDraft = (): NewPlayerDraft => ({
  name: "", rollNo: "", branch: "CE",
  year: "", division: "", program: "",
  enrollmentNo: "", mobileNo: "", email: "",
  isRated: false, officialElo: undefined,
});

export function SpotEntryDialog({
  open, onOpenChange, tournament, allPlayers, currentRound, onConfirm,
}: SpotEntryDialogProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<NewPlayerDraft>(blankDraft());
  const [staged, setStaged] = useState<Array<{ key: string; data: NewPlayerDraft }>>([]);

  // Players not yet in the tournament
  const eligible = allPlayers.filter(p => !(tournament.players as string[]).includes(p.id));
  const filtered = eligible.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.rollNo ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const stageNewPlayer = () => {
    if (!draft.name.trim()) return;
    setStaged(prev => [...prev, { key: `${Date.now()}-${Math.random()}`, data: { ...draft } }]);
    setDraft(blankDraft());
    setShowForm(false);
  };

  const removeStaged = (key: string) => setStaged(prev => prev.filter(s => s.key !== key));

  const total = selected.size + staged.length;

  const handleConfirm = () => {
    if (total === 0) return;
    onConfirm(Array.from(selected), staged.map(s => s.data));
    // Reset state
    setSelected(new Set());
    setStaged([]);
    setSearch("");
    setShowForm(false);
    setDraft(blankDraft());
    onOpenChange(false);
  };

  const catchUp = Math.max(0, currentRound - 1);

  return (
    <Dialog open={open} onOpenChange={open => {
      if (!open) {
        setSelected(new Set()); setStaged([]); setSearch("");
        setShowForm(false); setDraft(blankDraft());
      }
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-lg flex flex-col" style={{ maxHeight: "90vh" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Spot Entry
          </DialogTitle>
          <DialogDescription>
            {catchUp === 0
              ? "New players will be merged into the current round."
              : `New players will get ${catchUp} catch-up pairing${catchUp > 1 ? "s" : ""} (Rounds 1–${catchUp}) among themselves, then join Round ${currentRound}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">

          {/* ── Staged new players ─────────────────────────── */}
          {staged.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                New players to register
              </p>
              {staged.map(({ key, data }) => (
                <div key={key} className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium">{data.name}</span>
                    {data.rollNo && <span className="text-muted-foreground ml-2">{data.rollNo}</span>}
                    <span className="text-muted-foreground ml-2">· {data.branch}</span>
                  </div>
                  <button onClick={() => removeStaged(key)} className="ml-2 shrink-0 text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Select existing players ────────────────────── */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Select registered players
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-9"
                placeholder="Search by name or roll no…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-52 overflow-y-auto border rounded-lg divide-y">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {eligible.length === 0
                    ? "All registered players are already in this tournament."
                    : "No players match your search."}
                </p>
              ) : (
                filtered.map(p => (
                  <label
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selected.has(p.id)}
                      onCheckedChange={() => toggle(p.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.rollNo} · {p.branch}</p>
                    </div>
                    {selected.has(p.id) && (
                      <Badge variant="secondary" className="shrink-0 text-xs">Added</Badge>
                    )}
                  </label>
                ))
              )}
            </div>
          </div>

          {/* ── Register brand-new player ─────────────────── */}
          <div className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setShowForm(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Register &amp; add a new player
              </span>
              {showForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showForm && (
              <div className="px-4 pb-4 pt-3 border-t space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Name *</Label>
                    <Input
                      value={draft.name}
                      onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                      placeholder="Full name"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Roll No</Label>
                    <Input
                      value={draft.rollNo}
                      onChange={e => setDraft(d => ({ ...d, rollNo: e.target.value }))}
                      placeholder="e.g. DW236"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Branch</Label>
                    <Select value={draft.branch} onValueChange={v => setDraft(d => ({ ...d, branch: v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Mobile</Label>
                    <Input
                      value={draft.mobileNo ?? ""}
                      onChange={e => setDraft(d => ({ ...d, mobileNo: e.target.value }))}
                      placeholder="Mobile no."
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input
                      value={draft.email ?? ""}
                      onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
                      placeholder="Email"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Enrollment No.</Label>
                    <Input
                      value={draft.enrollmentNo ?? ""}
                      onChange={e => setDraft(d => ({ ...d, enrollmentNo: e.target.value }))}
                      placeholder="Enrollment / PRN"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Official Rating</Label>
                    <Input
                      type="number"
                      value={draft.officialElo ?? ""}
                      onChange={e => setDraft(d => ({ ...d, officialElo: e.target.value ? Number(e.target.value) : undefined }))}
                      placeholder="e.g. 1200"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Switch
                      checked={draft.isRated}
                      onCheckedChange={v => setDraft(d => ({ ...d, isRated: v }))}
                    />
                    <Label className="text-xs">Officially rated</Label>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={stageNewPlayer}
                  disabled={!draft.name.trim()}
                >
                  Add to Entry List
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-3 shrink-0 border-t pt-3">
          <div className="flex items-center justify-between w-full">
            <p className="text-sm text-muted-foreground">
              {total === 0 ? "No players selected" : `${total} player${total !== 1 ? "s" : ""} selected`}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleConfirm} disabled={total === 0}>
                Confirm Entry{total > 0 ? ` (${total})` : ""}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
