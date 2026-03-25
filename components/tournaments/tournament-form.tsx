"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Player, Tournament, calculateRounds } from "@/lib/types";
import { generateId } from "@/lib/utils-chess";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface TournamentFormProps {
  players: Player[];
  onSubmit: (tournament: Tournament) => void;
  initialTournament?: Tournament;
  isSubmitting?: boolean;
}

export function TournamentForm({ 
  players, 
  onSubmit, 
  initialTournament, 
  isSubmitting = false 
}: TournamentFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialTournament?.name || "");
  const [description, setDescription] = useState(initialTournament?.description || "");
  const [format, setFormat] = useState<"Swiss" | "RoundRobin" | "Knockout">(initialTournament?.format || "Swiss");
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(
    new Set(initialTournament?.players || [])
  );

  // Auto-calculate rounds based on format and player count
  const calculatedRounds = calculateRounds(selectedPlayers.size, format);

  const handlePlayerToggle = (playerId: string) => {
    const newSelected = new Set(selectedPlayers);
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId);
    } else {
      newSelected.add(playerId);
    }
    setSelectedPlayers(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedPlayers.size === players.length) {
      setSelectedPlayers(new Set());
    } else {
      setSelectedPlayers(new Set(players.map((p) => p.id)));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Tournament name is required");
      return;
    }

    if (selectedPlayers.size < 2) {
      toast.error("At least 2 players must be selected");
      return;
    }

    const tournament: Tournament = {
      id: initialTournament?.id || generateId(),
      name: name.trim(),
      description: description.trim() || undefined,
      format,
      status: "planning",
      rounds: calculatedRounds,
      currentRound: initialTournament?.currentRound || 0,
      players: Array.from(selectedPlayers),
      byes: [],
      timeControls: {},
      byeHistory: {},
      createdAt: initialTournament?.createdAt || Date.now(),
    };

    onSubmit(tournament);
    
    if (!initialTournament) {
      toast.success("Tournament created successfully!");
      // Auto-redirect to tournament detail page
      router.push(`/tournaments/${tournament.id}`);
    }
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>{initialTournament ? "Edit Tournament" : "Create Tournament"}</CardTitle>
        <CardDescription>Set up a new chess tournament</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Tournament Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Tournament Name *</Label>
                <Input
                  id="name"
                  placeholder="State Chess Championship 2024"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="format">Tournament Format *</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as typeof format)} disabled={isSubmitting}>
                  <SelectTrigger id="format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Swiss">Swiss System</SelectItem>
                    <SelectItem value="RoundRobin">Round Robin</SelectItem>
                    <SelectItem value="Knockout">Knockout</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Number of Rounds</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    {calculatedRounds}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {format === "RoundRobin" 
                      ? `(${selectedPlayers.size} players)` 
                      : format === "Swiss"
                      ? `(Swiss system)`
                      : `(Knockout)`}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add tournament details, rules, or notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                rows={3}
              />
            </div>
          </div>



          {/* Player Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Select Players ({selectedPlayers.size}/{players.length})</h3>
              {players.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={isSubmitting}
                >
                  {selectedPlayers.size === players.length ? "Deselect All" : "Select All"}
                </Button>
              )}
            </div>

            {players.length === 0 ? (
              <p className="text-sm text-muted-foreground">No players available. Add players first.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto border rounded-lg p-3">
                {players.map((player) => (
                  <div key={player.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={player.id}
                      checked={selectedPlayers.has(player.id)}
                      onCheckedChange={() => handlePlayerToggle(player.id)}
                      disabled={isSubmitting}
                    />
                    <Label 
                      htmlFor={player.id} 
                      className="flex-1 cursor-pointer text-sm font-normal"
                    >
                      {player.name} ({player.rollNo}) - {player.branch}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Saving..." : initialTournament ? "Update Tournament" : "Create Tournament"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
