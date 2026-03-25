"use client";

import { Player } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit2 } from "lucide-react";

interface PlayerListProps {
  players: Player[];
  onEdit?: (player: Player) => void;
  onDelete?: (id: string) => void;
  isLoading?: boolean;
}

export function PlayerList({ players, onEdit, onDelete, isLoading = false }: PlayerListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading players...</p>
        </CardContent>
      </Card>
    );
  }

  if (players.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No players registered yet. Add your first player!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registered Players</CardTitle>
        <CardDescription>{players.length} player(s) registered</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Roll No</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Elo</TableHead>
                <TableHead>Games</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player) => (
                <TableRow key={player.id}>
                  <TableCell className="font-medium">{player.name}</TableCell>
                  <TableCell>{player.rollNo}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{player.branch}</Badge>
                  </TableCell>
                  <TableCell>{player.class}</TableCell>
                  <TableCell>
                    <span className="font-semibold">{player.estimatedElo}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="text-sm whitespace-nowrap">
                      <span className="text-green-600 font-semibold">{player.wins}W</span>
                      <span className="mx-0.5 text-muted-foreground">/</span>
                      <span className="text-red-600 font-semibold">{player.losses}L</span>
                      <span className="mx-0.5 text-muted-foreground">/</span>
                      <span className="text-blue-600 font-semibold">{player.draws}D</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(player)}
                          title="Edit player"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Delete ${player.name}?`)) {
                              onDelete(player.id);
                            }
                          }}
                          title="Delete player"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
