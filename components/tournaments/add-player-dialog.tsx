"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Player } from "@/lib/types";
import { getShortPlayerName } from "@/lib/utils-chess";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

interface AddPlayerDialogProps {
  tournament: any;
  availablePlayers: Player[];
  onAddPlayers: (playerIds: string[]) => void;
  isLoading?: boolean;
}

export function AddPlayerDialog({
  tournament,
  availablePlayers,
  onAddPlayers,
  isLoading = false,
}: AddPlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());

  // Get players not already in tournament
  const unenrolledPlayers = availablePlayers.filter(
    (p) => !tournament.players.includes(p.id)
  );

  const filteredPlayers = unenrolledPlayers.filter((player) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().replace(/\s+/g, " ").trim();
    const name = (player.name || "").toLowerCase();
    const rollNo = (player.rollNo || "").toLowerCase();
    const branch = (player.branch || "").toLowerCase();
    return name.includes(query) || rollNo.includes(query) || branch.includes(query);
  });

  const handlePlayerToggle = (playerId: string) => {
    const newSelected = new Set(selectedPlayers);
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId);
    } else {
      newSelected.add(playerId);
    }
    setSelectedPlayers(newSelected);
  };

  const handleAddPlayers = () => {
    if (selectedPlayers.size === 0) {
      toast.error("Select at least one player");
      return;
    }

    onAddPlayers(Array.from(selectedPlayers));
    setSelectedPlayers(new Set());
    setSearchQuery("");
    setOpen(false);
    toast.success("Players added successfully!");
  };

  if (unenrolledPlayers.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearchQuery(""); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Players
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Players Mid-Tournament</DialogTitle>
          <DialogDescription>
            Selected players will join with 0 score and be eligible starting next round.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search player name, roll no, branch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-3">
            {filteredPlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No available players match your search.
              </p>
            ) : (
              filteredPlayers.map((player) => (
                <div key={player.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`add-${player.id}`}
                    checked={selectedPlayers.has(player.id)}
                    onCheckedChange={() => handlePlayerToggle(player.id)}
                    disabled={isLoading}
                  />
                  <Label
                    htmlFor={`add-${player.id}`}
                    className="flex-1 cursor-pointer text-sm font-normal"
                  >
                    {getShortPlayerName(player.name)} ({player.rollNo}) - {player.branch}
                  </Label>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs text-muted-foreground">
              {selectedPlayers.size} of {unenrolledPlayers.length} selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button onClick={handleAddPlayers} disabled={isLoading || selectedPlayers.size === 0}>
                Add {selectedPlayers.size > 0 ? `(${selectedPlayers.size})` : ""}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
