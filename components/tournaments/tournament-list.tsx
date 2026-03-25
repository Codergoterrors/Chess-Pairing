"use client";

import { Tournament, Player } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit2, ChevronRight } from "lucide-react";
import Link from "next/link";

interface TournamentListProps {
  tournaments: Tournament[];
  players: Player[];
  onEdit?: (tournament: Tournament) => void;
  onDelete?: (id: string) => void;
  isLoading?: boolean;
}

export function TournamentList({ 
  tournaments, 
  players, 
  onEdit, 
  onDelete, 
  isLoading = false 
}: TournamentListProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "planning":
        return "bg-blue-100 text-blue-800";
      case "in-progress":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTournamentPlayers = (tournamentId: string) => {
    const tournament = tournaments.find((t) => t.id === tournamentId);
    if (!tournament) return [];
    return players.filter((p) => tournament.players.includes(p.id));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading tournaments...</p>
        </CardContent>
      </Card>
    );
  }

  if (tournaments.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No tournaments yet. Create your first one!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {tournaments.map((tournament) => {
        const tournamentPlayers = getTournamentPlayers(tournament.id);

        return (
          <Card key={tournament.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <CardTitle>{tournament.name}</CardTitle>
                    <Badge className={getStatusColor(tournament.status)}>
                      {tournament.status}
                    </Badge>
                  </div>
                  {tournament.description && (
                    <CardDescription className="mt-2">{tournament.description}</CardDescription>
                  )}
                </div>
                <div className="flex gap-2">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(tournament)}
                      disabled={tournament.status !== "planning"}
                      title={tournament.status !== "planning" ? "Can only edit planning tournaments" : "Edit"}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Delete "${tournament.name}"?`)) {
                          onDelete(tournament.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Format</p>
                  <p className="text-lg font-semibold">{tournament.format}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rounds</p>
                  <p className="text-lg font-semibold">{tournament.currentRound}/{tournament.rounds}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Players</p>
                  <p className="text-lg font-semibold">{tournamentPlayers.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-sm">{new Date(tournament.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              
              <Link href={`/tournaments/${tournament.id}`}>
                <Button className="w-full" variant="outline">
                  View Details
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
