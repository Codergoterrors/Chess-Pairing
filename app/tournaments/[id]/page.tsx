"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { useChessData } from "@/hooks/useChessData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RoundPairings } from "@/components/tournaments/round-pairings";
import { StandingsTable } from "@/components/tournaments/standings-table";
import { ExportStandings } from "@/components/tournaments/export-standings";
import { AddPlayerDialog } from "@/components/tournaments/add-player-dialog";
import { TimeControlDialog } from "@/components/tournaments/time-control-dialog";
import { generateSwissPairings } from "@/lib/pairing-algorithm";
import { Standing, TimeControl, TimeControlConfig, Pairing } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { calculateCurrentRating } from "@/lib/utils-chess";
import { ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import Link from "next/link";

// ─── Recalculate standings from scratch from ALL completed pairings ───────────
// This prevents double-counting when results are undone and re-entered.
function recalculateStandingsFromScratch(
  allPairings: Pairing[],
  playerIds: string[],
  playersMap: Map<string, any>,
  tournamentId: string
): Map<string, Standing> {
  const result = new Map<string, Standing>();

  // Initialize everyone at 0
  playerIds.forEach((pid) => {
    const player = playersMap.get(pid);
    result.set(pid, {
      playerId: pid,
      tournamentId,
      score: 0,
      buchholz: 0,
      rating: player ? calculateCurrentRating(player) : 0,
      wins: 0,
      losses: 0,
      draws: 0,
      gamesPlayed: 0,
    });
  });

  // Apply every completed pairing once
  allPairings.forEach((pairing) => {
    if (pairing.isBye) {
      const s = result.get(pairing.player1Id);
      if (s) {
        s.score += 1;
        s.wins += 1;
        s.gamesPlayed += 1;
      }
      return;
    }

    if (!pairing.result || !pairing.player2Id) return;

    const s1 = result.get(pairing.player1Id);
    const s2 = result.get(pairing.player2Id);

    if (s1) {
      s1.gamesPlayed += 1;
      if (pairing.result === "win1") { s1.score += 1; s1.wins += 1; }
      else if (pairing.result === "win2") { s1.losses += 1; }
      else if (pairing.result === "draw") { s1.score += 0.5; s1.draws += 1; }
    }
    if (s2) {
      s2.gamesPlayed += 1;
      if (pairing.result === "win2") { s2.score += 1; s2.wins += 1; }
      else if (pairing.result === "win1") { s2.losses += 1; }
      else if (pairing.result === "draw") { s2.score += 0.5; s2.draws += 1; }
    }
  });

  // Buchholz: sum of opponents' scores
  allPairings.forEach((pairing) => {
    if (pairing.isBye || !pairing.result || !pairing.player2Id) return;
    const s1 = result.get(pairing.player1Id);
    const s2 = result.get(pairing.player2Id);
    if (s1 && s2) {
      s1.buchholz += s2.score;
      s2.buchholz += s1.score;
    }
  });

  return result;
}

export default function TournamentDetailPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const { players, tournaments, pairings, standings, isLoaded, updateTournament, addPairing, updatePairing, deletePairing, addStanding, updateStanding } =
    useChessData();

  const [currentRound, setCurrentRound] = useState(1);
  const [isGeneratingPairings, setIsGeneratingPairings] = useState(false);
  const [showTimeControlDialog, setShowTimeControlDialog] = useState(false);
  const [showManualResultDialog, setShowManualResultDialog] = useState(false);
  const [manualPlayer1, setManualPlayer1] = useState("");
  const [manualPlayer2, setManualPlayer2] = useState("");
  const [manualResult, setManualResult] = useState<"win1" | "win2" | "draw">("win1");
  const completionCheckedRef = useRef(false);

  const tournament = useMemo(() => tournaments.find((t) => t.id === id), [tournaments, id]);
  const tournamentPlayers = useMemo(() => players.filter((p) => tournament?.players.includes(p.id) || false), [players, tournament]);
  const playersMap = useMemo(() => new Map(tournamentPlayers.map((p) => [p.id, p])), [tournamentPlayers]);
  const tournamentPairings = useMemo(() => pairings.filter((p) => p.tournamentId === id), [pairings, id]);
  const tournamentStandings = useMemo(() => standings.filter((s) => s.tournamentId === id as string), [standings, id]);

  // Initialize standings if not exists
  useEffect(() => {
    if (!tournament || tournamentPlayers.length === 0 || !isLoaded) return;
    const existingStandings = standings.filter((s) => s.tournamentId === tournament.id);
    if (existingStandings.length > 0) return;
    tournamentPlayers.forEach((player) => {
      addStanding({
        playerId: player.id,
        tournamentId: tournament.id,
        score: 0, buchholz: 0,
        rating: calculateCurrentRating(player),
        wins: 0, losses: 0, draws: 0, gamesPlayed: 0,
      });
    });
  }, [tournament?.id, isLoaded, tournamentPlayers.length]);

  const standingsMap = useMemo(() => new Map(tournamentStandings.map((s) => [s.playerId, s])), [tournamentStandings]);

  // ── Shared: push recalculated standings to storage ───────────────────────
  const pushRecalculatedStandings = (updatedPairings: Pairing[]) => {
    if (!tournament) return;
    const fresh = recalculateStandingsFromScratch(
      updatedPairings,
      tournament.players,
      playersMap,
      tournament.id
    );
    fresh.forEach((standing) => {
      const existing = standingsMap.get(standing.playerId);
      if (existing) {
        updateStanding(standing);
      } else {
        addStanding(standing);
      }
    });
  };

  const handleAddPlayers = (playerIds: string[]) => {
    if (!tournament) return;
    updateTournament({ ...tournament, players: [...tournament.players, ...playerIds] });
    playerIds.forEach((playerId) => {
      const player = players.find((p) => p.id === playerId);
      if (player) {
        addStanding({
          playerId: player.id, tournamentId: tournament.id,
          score: 0, buchholz: 0, rating: calculateCurrentRating(player),
          wins: 0, losses: 0, draws: 0, gamesPlayed: 0,
        });
      }
    });
  };

  const handleTimeControlSelected = async (timeControl: TimeControl, config: Omit<TimeControlConfig, "type">) => {
    if (!tournament || tournamentPlayers.length < 2) {
      toast({ title: "Error", description: "Need at least 2 players" });
      return;
    }

    setShowTimeControlDialog(false);
    setIsGeneratingPairings(true);

    try {
      const activePlayers = tournament.format === "Knockout"
        ? tournamentPlayers.filter(p => {
            const standing = standingsMap.get(p.id);
            return !standing || standing.losses === 0;
          })
        : tournamentPlayers;

      const result = generateSwissPairings({
        players: activePlayers,
        standings: tournamentStandings,
        pairings: tournamentPairings,
        round: currentRound,
        byes: tournament.byes,
      });

      const newPairingsWithTournament = result.pairings.map(p => ({ ...p, tournamentId: tournament.id }));
      newPairingsWithTournament.forEach((pairing) => addPairing(pairing));

      // Recalculate standings including the new BYE points
      const allPairingsAfter = [...tournamentPairings, ...newPairingsWithTournament];
      pushRecalculatedStandings(allPairingsAfter);

      updateTournament({
        ...tournament,
        byes: result.byes,
        timeControls: { ...tournament.timeControls, [currentRound]: { type: timeControl, ...config } as TimeControlConfig },
        currentRound: Math.max(tournament.currentRound, currentRound),
        status: "in-progress" as const,
      });

      toast({ title: "Success", description: `Round ${currentRound} pairings generated!` });
    } catch (error) {
      console.error("Pairing generation error:", error);
      toast({ title: "Error", description: "Failed to generate pairings" });
    } finally {
      setIsGeneratingPairings(false);
    }
  };

  const handleGeneratePairings = () => setShowTimeControlDialog(true);

  const handleRemovePairing = (pairingId: string) => {
    deletePairing(pairingId);
    // Recalculate standings without the removed pairing
    const remaining = tournamentPairings.filter(p => p.id !== pairingId);
    pushRecalculatedStandings(remaining);
    toast({ title: "Pairing removed", description: "Standings updated." });
  };

  const handleSetResult = (pairingId: string, result: "win1" | "win2" | "draw" | undefined) => {
    const pairing = tournamentPairings.find((p) => p.id === pairingId);
    if (!pairing) return;

    const updatedPairing = { ...pairing, result: result as any };
    updatePairing(updatedPairing);

    // Recalculate ALL standings from scratch to prevent double-counting on undo/redo
    const allPairingsUpdated = tournamentPairings.map(p => p.id === pairingId ? updatedPairing : p);
    pushRecalculatedStandings(allPairingsUpdated);

    toast({ title: "Result recorded" });
  };

  // ── Manual Result Entry ───────────────────────────────────────────────────
  const handleManualResultSubmit = () => {
    if (!tournament || !manualPlayer1 || !manualPlayer2 || manualPlayer1 === manualPlayer2) {
      toast({ title: "Error", description: "Please select two different players" });
      return;
    }

    // Check if this pair already has a pairing in the current round
    const existingPairing = tournamentPairings.find(p =>
      p.roundNumber === currentRound &&
      ((p.player1Id === manualPlayer1 && p.player2Id === manualPlayer2) ||
       (p.player1Id === manualPlayer2 && p.player2Id === manualPlayer1))
    );

    if (existingPairing) {
      // Update existing pairing result
      const updatedPairing = { ...existingPairing, result: manualResult };
      updatePairing(updatedPairing);
      const allUpdated = tournamentPairings.map(p => p.id === existingPairing.id ? updatedPairing : p);
      pushRecalculatedStandings(allUpdated);
    } else {
      // Create a brand new manual pairing for this round
      const newPairing: Pairing = {
        id: crypto.randomUUID(),
        tournamentId: tournament.id,
        roundNumber: currentRound,
        player1Id: manualPlayer1,
        player2Id: manualPlayer2,
        result: manualResult,
        isBye: false,
        createdAt: Date.now(),
      };
      addPairing(newPairing);
      const allUpdated = [...tournamentPairings, newPairing];
      pushRecalculatedStandings(allUpdated);
    }

    setShowManualResultDialog(false);
    setManualPlayer1("");
    setManualPlayer2("");
    setManualResult("win1");
    toast({ title: "Result saved", description: "Standings updated." });
  };

  const roundPairings = useMemo(() => {
    if (!tournament) return [];
    return tournamentPairings.filter((p) => p.roundNumber === currentRound);
  }, [tournamentPairings, currentRound, tournament]);

  const allRoundsComplete = useMemo(() => {
    if (!tournament) return false;
    return currentRound > tournament.rounds;
  }, [currentRound, tournament?.rounds]);

  useEffect(() => {
    if (tournament && allRoundsComplete && tournament.status !== "completed" && !completionCheckedRef.current) {
      completionCheckedRef.current = true;
      updateTournament({ ...tournament, status: "completed" as const, endDate: Date.now() });
      toast({ title: "Tournament Completed!", description: "All rounds have been finished." });
    }
  }, [allRoundsComplete, tournament?.id]);

  if (!isLoaded) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!tournament) {
    return (
      <div className="container mx-auto py-10">
        <p>Tournament not found</p>
        <Link href="/tournaments"><Button>Back to Tournaments</Button></Link>
      </div>
    );
  }

  const p1Name = manualPlayer1 ? playersMap.get(manualPlayer1)?.name : "";
  const p2Name = manualPlayer2 ? playersMap.get(manualPlayer2)?.name : "";

  return (
    <div className="container mx-auto py-10">
      {/* Header */}
      <div className="mb-8">
        <Link href="/tournaments" className="text-sm text-muted-foreground hover:underline mb-4 inline-flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />Back to Tournaments
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{tournament.name}</h1>
            <div className="flex items-center gap-4 mt-2">
              <Badge>{tournament.format}</Badge>
              <Badge variant="outline">{tournament.status}</Badge>
              <span className="text-sm text-muted-foreground">
                {tournamentPlayers.length} players • {tournament.rounds} rounds
              </span>
            </div>
            {tournament.description && <p className="text-muted-foreground mt-2">{tournament.description}</p>}
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <AddPlayerDialog tournament={tournament} availablePlayers={players} onAddPlayers={handleAddPlayers} />

            {tournamentStandings.length > 0 && (
              <ExportStandings tournament={tournament} standings={tournamentStandings} players={playersMap} />
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="standings" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="standings">Standings</TabsTrigger>
          <TabsTrigger value="rounds">Rounds</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        <TabsContent value="standings" className="mt-6">
          <StandingsTable standings={tournamentStandings} players={playersMap} />
        </TabsContent>

        <TabsContent value="rounds" className="mt-6 space-y-6">
          <Card>
            <CardHeader><CardTitle>Round Selection</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <Button variant="outline" size="icon" onClick={() => setCurrentRound(Math.max(1, currentRound - 1))} disabled={currentRound === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center flex-1">
                  <p className="text-sm text-muted-foreground">Round {currentRound}</p>
                  <p className="text-2xl font-bold">{currentRound}/{tournament.rounds}</p>
                  {tournament.timeControls?.[currentRound] && (
                    <p className="text-xs text-blue-600 mt-1">
                      ⏱ {tournament.timeControls[currentRound].increment > 0
                        ? `${tournament.timeControls[currentRound].minutesPerSide}+${tournament.timeControls[currentRound].increment}`
                        : `${tournament.timeControls[currentRound].minutesPerSide} min`}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="icon" onClick={() => setCurrentRound(Math.min(tournament.rounds + 1, currentRound + 1))} disabled={allRoundsComplete}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {allRoundsComplete ? (
            <Card>
              <CardContent className="pt-6 flex flex-col items-center gap-4">
                <p className="text-center text-lg font-semibold">All rounds completed!</p>
                <p className="text-center text-muted-foreground">Tournament is finished.</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    const updatedTournament = {
                      ...tournament,
                      rounds: tournament.rounds + 1,
                      status: "in-progress" as const,
                    };
                    updateTournament(updatedTournament);
                    completionCheckedRef.current = false;
                    setCurrentRound(tournament.rounds + 1);
                    toast({ title: "Round added", description: `Round ${tournament.rounds + 1} added. Generate pairings to begin.` });
                  }}
                >
                  + Add Round {tournament.rounds + 1}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <RoundPairings
              tournament={tournament}
              pairings={tournamentPairings}
              players={playersMap}
              standings={standingsMap}
              round={currentRound}
              timeControl={tournament.timeControls?.[currentRound]}
              onSetResult={handleSetResult}
              onRemovePairing={handleRemovePairing}
              onGeneratePairings={roundPairings.length === 0 ? handleGeneratePairings : undefined}
              isGenerating={isGeneratingPairings}
            />
          )}
        </TabsContent>

        <TabsContent value="info" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Tournament Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div><p className="text-sm text-muted-foreground">Format</p><p className="text-lg font-semibold">{tournament.format}</p></div>
                <div><p className="text-sm text-muted-foreground">Status</p><p className="text-lg font-semibold">{tournament.status}</p></div>
                <div><p className="text-sm text-muted-foreground">Participants</p><p className="text-lg font-semibold">{tournamentPlayers.length}</p></div>
                <div><p className="text-sm text-muted-foreground">Total Rounds</p><p className="text-lg font-semibold">{tournament.rounds}</p></div>
                <div><p className="text-sm text-muted-foreground">Created</p><p className="text-lg font-semibold">{new Date(tournament.createdAt).toLocaleDateString()}</p></div>
              </div>
              <div className="mt-8">
                <h3 className="font-semibold mb-4">Participants</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {tournamentPlayers.map((player) => (
                    <div key={player.id} className="p-3 border rounded-lg">
                      <p className="font-semibold">{player.name}</p>
                      <p className="text-sm text-muted-foreground">{player.rollNo} • {player.branch}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Time Control Dialog */}
      <TimeControlDialog
        open={showTimeControlDialog}
        roundNumber={currentRound}
        onSelect={handleTimeControlSelected}
        onCancel={() => setShowTimeControlDialog(false)}
      />

      {/* Manual Result Dialog */}
      <Dialog open={showManualResultDialog} onOpenChange={(o) => !o && setShowManualResultDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enter Manual Result — Round {currentRound}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Player 1 (White)</Label>
              <Select value={manualPlayer1} onValueChange={setManualPlayer1}>
                <SelectTrigger><SelectValue placeholder="Select player 1..." /></SelectTrigger>
                <SelectContent>
                  {tournamentPlayers.map(p => (
                    <SelectItem key={p.id} value={p.id} disabled={p.id === manualPlayer2}>
                      {p.name} ({p.rollNo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Player 2 (Black)</Label>
              <Select value={manualPlayer2} onValueChange={setManualPlayer2}>
                <SelectTrigger><SelectValue placeholder="Select player 2..." /></SelectTrigger>
                <SelectContent>
                  {tournamentPlayers.map(p => (
                    <SelectItem key={p.id} value={p.id} disabled={p.id === manualPlayer1}>
                      {p.name} ({p.rollNo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Result</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "win1", label: p1Name ? `${p1Name} Wins` : "Player 1 Wins" },
                  { value: "draw", label: "Draw" },
                  { value: "win2", label: p2Name ? `${p2Name} Wins` : "Player 2 Wins" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setManualResult(opt.value as any)}
                    className={`p-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      manualResult === opt.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {manualPlayer1 && manualPlayer2 && (
              <div className="bg-secondary/40 rounded-lg p-3 text-sm text-center">
                <span className="font-semibold">{p1Name}</span>
                <span className="mx-2 text-muted-foreground">vs</span>
                <span className="font-semibold">{p2Name}</span>
                <div className="mt-1 text-primary font-medium">
                  {manualResult === "win1" ? `${p1Name} wins` : manualResult === "win2" ? `${p2Name} wins` : "Draw"}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualResultDialog(false)}>Cancel</Button>
            <Button onClick={handleManualResultSubmit} disabled={!manualPlayer1 || !manualPlayer2}>Save Result</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
