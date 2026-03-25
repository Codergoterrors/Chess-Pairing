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
import { Label } from "@/components/ui/label";
import { Player } from "@/lib/types";
import { Plus } from "lucide-react";
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
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());

  // Get players not already in tournament
  const unenrolledPlayers = availablePlayers.filter(
    (p) => !tournament.players.includes(p.id)
  );

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
    setOpen(false);
    toast.success("Players added successfully!");
  };

  if (unenrolledPlayers.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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

        <div className="space-y-4">
          <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-3">
            {unenrolledPlayers.map((player) => (
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
                  {player.name} ({player.rollNo}) - {player.branch}
                </Label>
              </div>
            ))}
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleAddPlayers} disabled={isLoading}>
              Add {selectedPlayers.size > 0 ? `(${selectedPlayers.size})` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
