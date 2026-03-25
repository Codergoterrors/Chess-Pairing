"use client";

import { useState, useMemo } from "react";
import { useChessData } from "@/hooks/useChessData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { calculateCurrentRating } from "@/lib/utils-chess";
import { Standing, Pairing } from "@/lib/types";
import { ChevronLeft, CheckCircle } from "lucide-react";
import Link from "next/link";

function recalculateStandings(
  allPairings: Pairing[],
  playerIds: string[],
  playersMap: Map<string, any>,
  tournamentId: string
): Map<string, Standing> {
  const result = new Map<string, Standing>();

  playerIds.forEach((pid) => {
    const player = playersMap.get(pid);
    result.set(pid, {
      playerId: pid, tournamentId,
      score: 0, buchholz: 0,
      rating: player ? calculateCurrentRating(player) : 0,
      wins: 0, losses: 0, draws: 0, gamesPlayed: 0,
    });
  });

  allPairings.forEach((p) => {
    if (p.isBye) {
      const s = result.get(p.player1Id);
      if (s) { s.score += 1; s.wins += 1; s.gamesPlayed += 1; }
      return;
    }
    if (!p.result || !p.player2Id) return;
    const s1 = result.get(p.player1Id);
    const s2 = result.get(p.player2Id);
    if (s1) {
      s1.gamesPlayed += 1;
      if (p.result === "win1") { s1.score += 1; s1.wins += 1; }
      else if (p.result === "win2") s1.losses += 1;
      else if (p.result === "draw") { s1.score += 0.5; s1.draws += 1; }
    }
    if (s2) {
      s2.gamesPlayed += 1;
      if (p.result === "win2") { s2.score += 1; s2.wins += 1; }
      else if (p.result === "win1") s2.losses += 1;
      else if (p.result === "draw") { s2.score += 0.5; s2.draws += 1; }
    }
  });

  allPairings.forEach((p) => {
    if (p.isBye || !p.result || !p.player2Id) return;
    const s1 = result.get(p.player1Id);
    const s2 = result.get(p.player2Id);
    if (s1 && s2) { s1.buchholz += s2.score; s2.buchholz += s1.score; }
  });

  return result;
}

type EntryMode = "game" | "bye";

export default function ManualResultPage() {
  const { toast } = useToast();
  const { players, tournaments, pairings, standings, addPairing, updatePairing, addStanding, updateStanding } = useChessData();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [entryMode, setEntryMode] = useState<EntryMode>("game");
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [player1Id, setPlayer1Id] = useState("");
  const [player2Id, setPlayer2Id] = useState("");
  const [result, setResult] = useState<"win1" | "win2" | "draw">("win1");
  const [saved, setSaved] = useState(false);

  const tournament = useMemo(() => tournaments.find(t => t.id === selectedTournamentId), [tournaments, selectedTournamentId]);
  const tournamentPlayers = useMemo(() => players.filter(p => tournament?.players.includes(p.id)), [players, tournament]);
  const playersMap = useMemo(() => new Map(tournamentPlayers.map(p => [p.id, p])), [tournamentPlayers]);
  const tournamentPairings = useMemo(() => pairings.filter(p => p.tournamentId === selectedTournamentId), [pairings, selectedTournamentId]);
  const tournamentStandings = useMemo(() => standings.filter(s => s.tournamentId === selectedTournamentId), [standings, selectedTournamentId]);
  const standingsMap = useMemo(() => new Map(tournamentStandings.map(s => [s.playerId, s])), [tournamentStandings]);

  const p1 = playersMap.get(player1Id);
  const p2 = playersMap.get(player2Id);
  const activeTournaments = tournaments.filter(t => t.status === "in-progress" || t.status === "completed");

  const canProceedToStep3 = entryMode === "bye" ? !!player1Id : (!!player1Id && !!player2Id);

  const handleSave = () => {
    if (!tournament || !player1Id) return;

    let updatedPairings: Pairing[];

    if (entryMode === "bye") {
      // Check if BYE already exists for this player in this round
      const existingBye = tournamentPairings.find(p =>
        p.roundNumber === selectedRound && p.isBye && p.player1Id === player1Id
      );

      if (existingBye) {
        // Already has a bye — nothing to do
        toast({ title: "Already exists", description: `${p1?.name} already has a BYE in Round ${selectedRound}.` });
        return;
      }

      const newPairing: Pairing = {
        id: crypto.randomUUID(),
        tournamentId: tournament.id,
        roundNumber: selectedRound,
        player1Id,
        isBye: true,
        createdAt: Date.now(),
      };
      addPairing(newPairing);
      updatedPairings = [...tournamentPairings, newPairing];

    } else {
      if (!player2Id || player1Id === player2Id) return;

      const existingPairing = tournamentPairings.find(p =>
        p.roundNumber === selectedRound && !p.isBye &&
        ((p.player1Id === player1Id && p.player2Id === player2Id) ||
         (p.player1Id === player2Id && p.player2Id === player1Id))
      );

      if (existingPairing) {
        const updated = { ...existingPairing, result };
        updatePairing(updated);
        updatedPairings = tournamentPairings.map(p => p.id === existingPairing.id ? updated : p);
      } else {
        const newPairing: Pairing = {
          id: crypto.randomUUID(),
          tournamentId: tournament.id,
          roundNumber: selectedRound,
          player1Id, player2Id, result,
          isBye: false,
          createdAt: Date.now(),
        };
        addPairing(newPairing);
        updatedPairings = [...tournamentPairings, newPairing];
      }
    }

    const fresh = recalculateStandings(updatedPairings, tournament.players, playersMap, tournament.id);
    fresh.forEach((standing) => {
      if (standingsMap.has(standing.playerId)) updateStanding(standing);
      else addStanding(standing);
    });

    setSaved(true);
    toast({ title: "Saved!", description: "Standings updated." });
  };

  const handleReset = () => {
    setStep(1);
    setEntryMode("game");
    setSelectedTournamentId("");
    setSelectedRound(1);
    setPlayer1Id("");
    setPlayer2Id("");
    setResult("win1");
    setSaved(false);
  };

  const resultLabel = entryMode === "bye"
    ? `${p1?.name ?? "Player"} — BYE (+1 point)`
    : result === "win1" ? `${p1?.name ?? "Player 1"} Wins`
    : result === "win2" ? `${p2?.name ?? "Player 2"} Wins`
    : "Draw";

  return (
    <div className="container mx-auto py-10 max-w-xl">
      <Link href="/" className="text-sm text-muted-foreground hover:underline mb-6 inline-flex items-center gap-1">
        <ChevronLeft className="h-4 w-4" /> Back to Home
      </Link>

      <h1 className="text-3xl font-bold tracking-tight mb-2">Manual Result Entry</h1>
      <p className="text-muted-foreground mb-8">Manually enter a game result or assign a BYE for any round.</p>

      {saved ? (
        <Card>
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <p className="text-xl font-bold">Saved!</p>
            <p className="text-muted-foreground text-center">
              {entryMode === "bye" ? (
                <><span className="font-semibold">{p1?.name}</span> received a <span className="text-yellow-500 font-semibold">BYE</span> in Round {selectedRound}</>
              ) : (
                <><span className="font-semibold">{p1?.name}</span> vs <span className="font-semibold">{p2?.name}</span><br /><span className="text-primary font-semibold">{resultLabel}</span></>
              )}
              <br /><span className="text-sm">{tournament?.name}, Round {selectedRound}</span>
            </p>
            <div className="flex gap-3 mt-2">
              <Button onClick={handleReset}>Enter Another</Button>
              <Link href={`/tournaments/${selectedTournamentId}`}>
                <Button variant="outline">View Tournament</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">

          {/* Step 1 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge className="w-6 h-6 flex items-center justify-center p-0 text-xs">1</Badge>
                <CardTitle className="text-base">Select Tournament & Round</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Tournament</Label>
                <Select value={selectedTournamentId} onValueChange={(v) => {
                  setSelectedTournamentId(v);
                  setPlayer1Id(""); setPlayer2Id(""); setSaved(false);
                  const t = tournaments.find(t => t.id === v);
                  setSelectedRound(t?.currentRound || 1);
                }}>
                  <SelectTrigger><SelectValue placeholder="Choose a tournament..." /></SelectTrigger>
                  <SelectContent>
                    {activeTournaments.length === 0
                      ? <SelectItem value="none" disabled>No active tournaments</SelectItem>
                      : activeTournaments.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name} ({t.status})</SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>

              {tournament && (
                <div className="space-y-1">
                  <Label>Round</Label>
                  <div className="flex gap-2 flex-wrap">
                    {Array.from({ length: tournament.rounds }, (_, i) => i + 1).map(r => (
                      <button key={r} onClick={() => setSelectedRound(r)}
                        className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${selectedRound === r ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
                        Round {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Entry mode toggle */}
              {tournament && (
                <div className="space-y-1">
                  <Label>Entry Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: "game", label: "⚔️ Game Result", desc: "Two players played" },
                      { value: "bye",  label: "🏖️ BYE",         desc: "Player gets free point" },
                    ] as const).map(opt => (
                      <button key={opt.value} onClick={() => { setEntryMode(opt.value); setPlayer2Id(""); }}
                        className={`p-3 rounded-lg border-2 text-left text-sm transition-all ${entryMode === opt.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
                        <div className="font-semibold">{opt.label}</div>
                        <div className="text-xs text-muted-foreground">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tournament && <Button size="sm" onClick={() => setStep(2)} className="mt-1">Next →</Button>}
            </CardContent>
          </Card>

          {/* Step 2 */}
          <Card className={step >= 2 ? "" : "opacity-40 pointer-events-none"}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge className="w-6 h-6 flex items-center justify-center p-0 text-xs">2</Badge>
                <CardTitle className="text-base">
                  {entryMode === "bye" ? "Select Player (who gets BYE)" : "Select Players"}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>{entryMode === "bye" ? "Player receiving BYE" : "Player 1 (White / Left)"}</Label>
                <Select value={player1Id} onValueChange={setPlayer1Id}>
                  <SelectTrigger><SelectValue placeholder="Select player..." /></SelectTrigger>
                  <SelectContent>
                    {tournamentPlayers.map(p => (
                      <SelectItem key={p.id} value={p.id} disabled={p.id === player2Id}>
                        {p.name} — {p.rollNo} {p.estimatedElo || p.officialElo ? `(${p.estimatedElo || p.officialElo})` : "(NR)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {entryMode === "game" && (
                <div className="space-y-1">
                  <Label>Player 2 (Black / Right)</Label>
                  <Select value={player2Id} onValueChange={setPlayer2Id}>
                    <SelectTrigger><SelectValue placeholder="Select player..." /></SelectTrigger>
                    <SelectContent>
                      {tournamentPlayers.map(p => (
                        <SelectItem key={p.id} value={p.id} disabled={p.id === player1Id}>
                          {p.name} — {p.rollNo} {p.estimatedElo || p.officialElo ? `(${p.estimatedElo || p.officialElo})` : "(NR)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {canProceedToStep3 && (
                <Button size="sm" onClick={() => setStep(3)}>Next →</Button>
              )}
            </CardContent>
          </Card>

          {/* Step 3 */}
          <Card className={step >= 3 ? "" : "opacity-40 pointer-events-none"}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge className="w-6 h-6 flex items-center justify-center p-0 text-xs">3</Badge>
                <CardTitle className="text-base">
                  {entryMode === "bye" ? "Confirm BYE" : "Enter Result"}
                </CardTitle>
              </div>
              {entryMode === "game" && p1 && p2 && (
                <CardDescription>{p1.name} vs {p2.name} — {tournament?.name}, Round {selectedRound}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">

              {entryMode === "bye" ? (
                // BYE confirmation
                <div className="bg-yellow-500/10 border-2 border-yellow-500/40 rounded-lg p-4 text-center space-y-2">
                  <div className="text-3xl">🏖️</div>
                  <p className="font-bold text-lg">{p1?.name ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">{p1?.rollNo} • {p1?.branch}</p>
                  <Badge className="bg-yellow-500 text-black font-bold px-4 py-1">BYE — +1 point</Badge>
                  <p className="text-xs text-muted-foreground mt-1">Round {selectedRound} · {tournament?.name}</p>
                </div>
              ) : (
                // Game result buttons
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: "win1", label: p1?.name ? `${p1.name} Wins` : "Player 1 Wins" },
                      { value: "draw", label: "Draw" },
                      { value: "win2", label: p2?.name ? `${p2.name} Wins` : "Player 2 Wins" },
                    ].map(opt => (
                      <button key={opt.value} onClick={() => setResult(opt.value as any)}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all text-center ${result === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {p1 && p2 && (
                    <div className="bg-secondary/40 rounded-lg p-3 text-sm text-center">
                      <span className="font-semibold">{p1.name}</span>
                      <span className="mx-2 text-muted-foreground">vs</span>
                      <span className="font-semibold">{p2.name}</span>
                      <div className="mt-1 text-primary font-semibold">{resultLabel}</div>
                    </div>
                  )}
                </>
              )}

              <Button className="w-full" onClick={handleSave} disabled={!player1Id || (entryMode === "game" && !player2Id)}>
                {entryMode === "bye" ? "Assign BYE & Update Standings" : "Save Result & Update Standings"}
              </Button>
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  );
}
