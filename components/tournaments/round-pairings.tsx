"use client";

import { Pairing, Player, Standing, TimeControlConfig } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateCurrentRating } from "@/lib/utils-chess";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoundPairingsProps {
  tournament: { id: string; name: string; rounds: number; currentRound: number };
  pairings: Pairing[];
  players: Map<string, Player>;
  standings: Map<string, Standing>;
  round: number;
  timeControl?: TimeControlConfig;
  onSetResult?: (pairingId: string, result: "win1" | "win2" | "draw") => void;
  onRemovePairing?: (pairingId: string) => void;
  onGeneratePairings?: () => void;
  isGenerating?: boolean;
}

export function RoundPairings({
  tournament,
  pairings,
  players,
  standings,
  round,
  timeControl,
  onSetResult,
  onRemovePairing,
  onGeneratePairings,
  isGenerating = false,
}: RoundPairingsProps) {
  const roundPairings = pairings.filter((p) => p.roundNumber === round);
  const completedCount = roundPairings.filter((p) => p.result !== undefined).length;

  const getPlayerInfo = (playerId: string) => {
    const player = players.get(playerId);
    const standing = standings.get(playerId);
    if (!player) return null;

    return {
      name: player.name,
      rollNo: player.rollNo,
      elo: calculateCurrentRating(player),
      score: standing?.score || 0,
      gamesPlayed: standing?.gamesPlayed || 0,
    };
  };

  const timeControlDisplay = timeControl ? (
    timeControl.increment > 0 
      ? `${timeControl.minutesPerSide}+${timeControl.increment}`
      : `${timeControl.minutesPerSide} min`
  ) : null;

  // ── Detect Finals round: label Grand Final vs 3rd Place Match ──────────
  const standingsMapLocal = standings; 
  const roundPairingsNoBye = roundPairings.filter(p => !p.isBye && p.player2Id);

  const isFinalRound = (() => {
    const hasZeroLossBoth = roundPairingsNoBye.some(p => {
      const l1 = standingsMapLocal.get(p.player1Id)?.losses ?? 0;
      const l2 = standingsMapLocal.get(p.player2Id!)?.losses ?? 0;
      return l1 === 0 && l2 === 0;
    });
    const hasOneLossBoth = roundPairingsNoBye.some(p => {
      const l1 = standingsMapLocal.get(p.player1Id)?.losses ?? 0;
      const l2 = standingsMapLocal.get(p.player2Id!)?.losses ?? 0;
      return l1 === 1 && l2 === 1;
    });
    return hasZeroLossBoth && hasOneLossBoth;
  })();

  const getFinalLabel = (pairing: Pairing): "final" | "third" | null => {
    if (!isFinalRound || pairing.isBye || !pairing.player2Id) return null;
    const l1 = standingsMapLocal.get(pairing.player1Id)?.losses ?? 0;
    const l2 = standingsMapLocal.get(pairing.player2Id)?.losses ?? 0;
    if (l1 === 0 && l2 === 0) return "final";
    if (l1 === 1 && l2 === 1) return "third";
    return null;
  };
  // ─────────────────────────────────────────────────────────────────────────

  if (roundPairings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Round {round} - Pairings</CardTitle>
              <CardDescription>No pairings generated yet</CardDescription>
            </div>
            {timeControlDisplay && (
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                ⏱ {timeControlDisplay}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {onGeneratePairings && (
            <Button onClick={onGeneratePairings} disabled={isGenerating} className="w-full">
              {isGenerating ? "Generating..." : "Generate Pairings"}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              Round {round} - Pairings
              {timeControlDisplay && (
                <span className="text-base font-normal text-muted-foreground ml-2">
                  • <span className="text-blue-600">⏱ {timeControlDisplay}</span>
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {completedCount}/{roundPairings.length} games completed
            </CardDescription>
          </div>
          <Badge variant={completedCount === roundPairings.length ? "default" : "outline"}>
            {completedCount === roundPairings.length ? "Complete" : "In Progress"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {roundPairings.map((pairing) => {
            const player1Info = getPlayerInfo(pairing.player1Id);

            if (pairing.isBye) {
              return (
                <div key={pairing.id} className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold">{player1Info?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {player1Info?.rollNo} • Rating: {player1Info?.elo} • Score: {player1Info?.score}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-500 hover:bg-amber-600 whitespace-nowrap">
                        BYE
                      </Badge>
                      <Badge variant="outline" className="whitespace-nowrap">
                        +1 point
                      </Badge>
                      {onRemovePairing && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Remove BYE"
                          onClick={() => onRemovePairing(pairing.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            const player2Info = pairing.player2Id ? getPlayerInfo(pairing.player2Id) : null;

            return (
              <div
                key={pairing.id}
                className={cn(
                  "p-4 border rounded-lg",
                  getFinalLabel(pairing) === "final" && "border-yellow-500/50 bg-yellow-500/5",
                  getFinalLabel(pairing) === "third" && "border-amber-700/40 bg-amber-900/10",
                )}
              >
                {/* Finals label */}
                {getFinalLabel(pairing) === "final" && (
                  <div className="mb-3">
                    <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold text-xs gap-1">
                      🏆 Grand Final
                    </Badge>
                  </div>
                )}
                {getFinalLabel(pairing) === "third" && (
                  <div className="mb-3">
                    <Badge variant="outline" className="border-amber-600/50 text-amber-500 font-bold text-xs gap-1">
                      🥉 3rd Place Match
                    </Badge>
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  {/* Player 1 */}
                  <div className="flex-1">
                    <p className="font-semibold">{player1Info?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {player1Info?.rollNo} • Rating: {player1Info?.elo}
                    </p>
                    {player1Info && (
                      <p className="text-xs text-muted-foreground">
                        Score: {player1Info.score} • Games: {player1Info.gamesPlayed}
                      </p>
                    )}
                  </div>

                  {/* Result or VS */}
                  <div className="px-4 text-center min-w-fit">
                    {pairing.result ? (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">
                          {pairing.result === "draw"
                            ? "Draw"
                            : pairing.result === "win1"
                              ? "1-0"
                              : "0-1"}
                        </p>
                        {onSetResult && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSetResult(pairing.id, undefined as any)}
                            className="text-xs h-6"
                          >
                            Undo
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground font-medium">vs</p>
                    )}
                  </div>

                  {/* Player 2 */}
                  <div className="flex-1 text-right">
                    <p className="font-semibold">{player2Info?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {player2Info?.rollNo} • Rating: {player2Info?.elo}
                    </p>
                    {player2Info && (
                      <p className="text-xs text-muted-foreground">
                        Score: {player2Info.score} • Games: {player2Info.gamesPlayed}
                      </p>
                    )}
                  </div>
                </div>

                {!pairing.result && onSetResult && (
                  <div className="flex gap-2 justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSetResult(pairing.id, "win1")}
                      className="flex-1"
                    >
                      {player1Info?.name.split(" ")[0]} Wins
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSetResult(pairing.id, "draw")}
                      className="flex-1"
                    >
                      Draw
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSetResult(pairing.id, "win2")}
                      className="flex-1"
                    >
                      {player2Info?.name.split(" ")[0]} Wins
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
