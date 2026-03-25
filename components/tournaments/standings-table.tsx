"use client";

import { Standing, Player } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal } from "lucide-react";

interface StandingsTableProps {
  standings: Standing[];
  players: Map<string, Player>;
  title?: string;
}

export function StandingsTable({ standings, players, title = "Tournament Standings" }: StandingsTableProps) {
  const sortedStandings = [...standings].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.buchholz - a.buchholz;
  });

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-700" />;
    return null;
  };

  const getRowBgClass = (rank: number) => {
    if (rank === 1) return "bg-yellow-50 dark:bg-yellow-950/20";
    if (rank === 2) return "bg-gray-50 dark:bg-gray-950/20";
    if (rank === 3) return "bg-amber-50 dark:bg-amber-950/20";
    return "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{standings.length} participants</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Rank</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Roll No</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Division</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="text-center">W-L-D</TableHead>
                <TableHead className="text-center">Buchholz</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStandings.map((standing, index) => {
                const player = players.get(standing.playerId);
                const rank = index + 1;
                if (!player) return null;
                const p = player as any;

                return (
                  <TableRow key={standing.playerId} className={`${getRowBgClass(rank)} ${rank <= 3 ? "border-l-4 border-l-primary" : ""}`}>
                    <TableCell className="font-bold">
                      <div className="flex items-center gap-2">
                        {getMedalIcon(rank)}
                        <span>{rank}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">{player.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{player.rollNo}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{player.branch}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.year || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.division || "—"}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {player.isRated ? standing.rating : <span className="text-muted-foreground">NR</span>}
                    </TableCell>
                    <TableCell className="text-center font-bold text-lg">
                      {standing.score.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      <div className="space-x-0.5">
                        <span className="text-green-600 font-semibold">{standing.wins}W</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-red-600 font-semibold">{standing.losses}L</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-blue-600 font-semibold">{standing.draws}D</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm">{standing.buchholz.toFixed(1)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}