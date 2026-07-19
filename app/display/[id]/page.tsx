"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Refresh interval ──────────────────────────────────────────
const REFRESH = 30;

// ── Row mappers ───────────────────────────────────────────────
function mapT(r: any) {
  return {
    id: r.id as string, name: r.name as string,
    description: r.description as string | undefined,
    format: r.format as string, status: r.status as string,
    rounds: r.rounds as number,
    currentRound: (r.current_round ?? 0) as number,
    players: (r.players ?? []) as string[],
    startDate: r.start_date as number | undefined,
  };
}
function mapP(r: any) {
  return {
    id: r.id as string, name: r.name as string,
    rollNo: (r.roll_no ?? "") as string,
    branch: (r.branch ?? "") as string,
    officialElo: r.official_elo as number | null,
    estimatedElo: r.estimated_elo as number | null,
    fideRating: r.fide_rating as number | null,
  };
}
function mapPa(r: any) {
  return {
    id: r.id as string,
    roundNumber: r.round_number as number,
    player1Id: r.player1_id as string,
    player2Id: r.player2_id as string | undefined,
    result: r.result as "win1" | "win2" | "draw" | undefined,
    isBye: r.is_bye as boolean,
    createdAt: (r.created_at ?? 0) as number,
  };
}
function mapSt(r: any) {
  return {
    playerId: r.player_id as string,
    score: Number(r.score),
    buchholz: Number(r.buchholz),
    wins: (r.wins ?? 0) as number,
    losses: (r.losses ?? 0) as number,
    draws: (r.draws ?? 0) as number,
  };
}

type TRec  = ReturnType<typeof mapT>;
type PRec  = ReturnType<typeof mapP>;
type PaRec = ReturnType<typeof mapPa>;
type StRec = ReturnType<typeof mapSt>;

function elo(p: PRec | undefined): string {
  if (!p) return "NR";
  const v = p.officialElo ?? p.fideRating ?? p.estimatedElo ?? null;
  return v && v >= 100 ? String(v) : "NR";
}

// ══════════════════════════════════════════════════════════════
export default function DisplayPage() {
  const { id } = useParams<{ id: string }>();

  const [t, setT]     = useState<TRec | null>(null);
  const [pl, setPl]   = useState<PRec[]>([]);
  const [pa, setPa]   = useState<PaRec[]>([]);
  const [st, setSt]   = useState<StRec[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [clock, setClock]     = useState(new Date());
  const [cd, setCd]           = useState(REFRESH);
  const [round, setRound]     = useState(1);

  const fetchAll = useCallback(async () => {
    const { data: tRow, error: tErr } = await supabase
      .from("tournaments").select("*").eq("id", id).single();
    if (tErr || !tRow) {
      setErr(tErr?.message ?? "Tournament not found or access denied.");
      setLoading(false); return;
    }
    const tRec = mapT(tRow);
    setT(tRec);
    setRound(prev => prev === 1 ? Math.max(1, tRec.currentRound) : prev);

    if (tRec.players.length > 0) {
      const { data: pRows } = await supabase
        .from("players")
        .select("id,name,roll_no,branch,official_elo,estimated_elo,fide_rating")
        .in("id", tRec.players);
      setPl((pRows ?? []).map(mapP));
    }

    const { data: paRows } = await supabase
      .from("pairings").select("*").eq("tournament_id", id);
    setPa((paRows ?? []).map(mapPa));

    const { data: stRows } = await supabase
      .from("standings").select("*").eq("tournament_id", id);
    setSt((stRows ?? []).map(mapSt));

    setUpdated(new Date());
    setCd(REFRESH);
    setErr(null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, REFRESH * 1000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  useEffect(() => {
    const iv = setInterval(() => setCd(v => Math.max(0, v - 1)), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const plMap    = useMemo(() => new Map(pl.map(p => [p.id, p])), [pl]);
  const roundPa  = useMemo(() => pa.filter(p => p.roundNumber === round).sort((a, b) => a.createdAt - b.createdAt), [pa, round]);
  const sortedSt = useMemo(() => [...st].sort((a, b) => b.score - a.score || b.buchholz - a.buchholz), [st]);
  const done     = roundPa.filter(p => p.result || p.isBye).length;
  const maxRound = t ? Math.max(t.rounds, t.currentRound) : 1;

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-2">
          <Trophy className="h-10 w-10 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading tournament…</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────
  if (err || !t) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" /> Unable to Load Tournament
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{err}</p>
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <p className="font-medium">To enable public access:</p>
              <p className="text-muted-foreground">
                Run the <strong>public read SQL</strong> in your Supabase dashboard,
                or open this page while logged in.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCurrent = round === t.currentRound;
  const pct = roundPa.length > 0 ? (done / roundPa.length) * 100 : 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">

      {/* ── HEADER ─────────────────────────────────────────── */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {/* LIVE pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 border border-destructive/30 shrink-0 mt-1">
              <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-[10px] font-bold text-destructive tracking-widest uppercase">Live</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight leading-tight truncate">{t.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="secondary">{t.format}</Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    t.status === "in-progress" && "border-green-500/50 text-green-500",
                    t.status === "completed"   && "border-yellow-500/50 text-yellow-500",
                    t.status === "planning"    && "border-muted-foreground/50",
                  )}
                >
                  {t.status.replace("-", " ")}
                </Badge>
                <span className="text-sm text-muted-foreground">{pl.length} players</span>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-sm text-muted-foreground">{t.rounds} rounds</span>
                {t.startDate && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(t.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Clock */}
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {clock.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {clock.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long" })}
            </p>
          </div>
        </div>
      </header>

      {/* ── ROUND SELECTOR ─────────────────────────────────── */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="icon"
              className="h-7 w-7"
              disabled={round <= 1}
              onClick={() => setRound(r => r - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm">
              <span className="font-bold">Round {round}</span>
              <span className="text-muted-foreground"> / {t.rounds}</span>
              {isCurrent && (
                <Badge variant="secondary" className="ml-2 text-xs py-0">Current</Badge>
              )}
            </div>
            <Button
              variant="outline" size="icon"
              className="h-7 w-7"
              disabled={round >= maxRound}
              onClick={() => setRound(r => r + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {roundPa.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{done}/{roundPa.length} boards done</span>
              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ───────────────────────────────────── */}
      <div className="flex-1 container mx-auto px-4 py-4 min-h-0">
        <div className="flex gap-4" style={{ minHeight: "calc(100vh - 200px)" }}>

          {/* Pairings panel */}
          <div className="flex-[3] flex flex-col gap-3 overflow-y-auto pr-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Round {round} Pairings
            </p>

            {roundPa.length === 0 ? (
              <Card>
                <CardContent className="pt-10 pb-10 flex flex-col items-center gap-2 text-center">
                  <Trophy className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-muted-foreground">No pairings for Round {round} yet</p>
                </CardContent>
              </Card>
            ) : roundPa.map((pairing, idx) => {
              const p1 = plMap.get(pairing.player1Id);
              const p2 = pairing.player2Id ? plMap.get(pairing.player2Id) : undefined;
              const isP1Win = pairing.result === "win1";
              const isP2Win = pairing.result === "win2";
              const isDraw  = pairing.result === "draw";
              const pending = !pairing.result && !pairing.isBye;

              return (
                <Card
                  key={pairing.id}
                  className={cn(pending && "border-primary/30")}
                >
                  <CardContent className="p-4">
                    {/* Board header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Board {idx + 1}
                      </span>
                      {pairing.isBye ? (
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white">BYE · +1 pt</Badge>
                      ) : pairing.result ? (
                        <Badge variant={isDraw ? "secondary" : "default"}
                          className={cn(
                            isP1Win || isP2Win ? "bg-green-500/10 text-green-500 border-green-500/30 hover:bg-green-500/20" : "",
                            isDraw ? "bg-blue-500/10 text-blue-500 border-blue-500/30" : "",
                          )}
                        >
                          {isDraw ? "½–½ Draw" : isP1Win ? "1–0 White Wins" : "0–1 Black Wins"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="animate-pulse text-primary border-primary/40">
                          ● Ongoing
                        </Badge>
                      )}
                    </div>

                    {pairing.isBye ? (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                        <div className="flex-1">
                          <p className="font-semibold text-base">{p1?.name ?? "Unknown"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{p1?.rollNo} · {p1?.branch} · {elo(p1)}</p>
                        </div>
                        <span className="text-amber-500 text-xl">⭐</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {/* Player 1 */}
                        <div className={cn(
                          "flex-1 p-3 rounded-lg transition-colors",
                          isP1Win && "bg-green-500/8 border border-green-500/20",
                          isDraw  && "bg-blue-500/8 border border-blue-500/15",
                          !pairing.result && "bg-muted/30",
                        )}>
                          <p className={cn("font-semibold text-sm leading-tight", isP1Win && "text-green-400")}>
                            {p1?.name ?? "Unknown"}
                            {isP1Win && " ✓"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            ⬜ {p1?.branch} · <span className="font-medium">{elo(p1)}</span>
                          </p>
                        </div>

                        {/* Score */}
                        <div className="w-10 text-center shrink-0">
                          {pairing.result ? (
                            <div className="space-y-0.5">
                              <p className={cn("text-sm font-bold leading-tight", isP1Win ? "text-green-400" : isDraw ? "text-blue-400" : "text-destructive")}>
                                {isDraw ? "½" : isP1Win ? "1" : "0"}
                              </p>
                              <p className="text-[10px] text-muted-foreground/50">—</p>
                              <p className={cn("text-sm font-bold leading-tight", isP2Win ? "text-green-400" : isDraw ? "text-blue-400" : "text-destructive")}>
                                {isDraw ? "½" : isP2Win ? "1" : "0"}
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground font-medium">vs</p>
                          )}
                        </div>

                        {/* Player 2 */}
                        <div className={cn(
                          "flex-1 p-3 rounded-lg text-right transition-colors",
                          isP2Win && "bg-green-500/8 border border-green-500/20",
                          isDraw  && "bg-blue-500/8 border border-blue-500/15",
                          !pairing.result && "bg-muted/30",
                        )}>
                          <p className={cn("font-semibold text-sm leading-tight", isP2Win && "text-green-400")}>
                            {isP2Win && "✓ "}
                            {p2?.name ?? "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <span className="font-medium">{elo(p2)}</span> · {p2?.branch} ⬛
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Standings panel */}
          <div className="flex-[2] overflow-y-auto">
            <Card className="sticky top-0">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Standings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {["#", "Player", "Pts", "W", "L", "D"].map(h => (
                        <th key={h} className={cn(
                          "py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide",
                          h === "Player" ? "text-left px-4" : "text-center px-2",
                        )}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSt.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-6 text-muted-foreground text-xs">No standings yet</td></tr>
                    ) : sortedSt.map((s, i) => {
                      const player = plMap.get(s.playerId);
                      const top3 = i < 3;
                      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                      return (
                        <tr key={s.playerId} className={cn(
                          "border-b border-border/50 transition-colors hover:bg-muted/30",
                          top3 && "bg-amber-500/5",
                        )}>
                          <td className="py-2.5 text-center px-2">
                            {medal
                              ? <span className="text-base">{medal}</span>
                              : <span className="text-xs text-muted-foreground font-medium">{i + 1}</span>
                            }
                          </td>
                          <td className="py-2.5 px-4">
                            <p className={cn("leading-tight truncate max-w-[11rem]", top3 ? "font-semibold" : "font-medium text-sm")}>
                              {player?.name ?? "Unknown"}
                            </p>
                            {player?.rollNo && (
                              <p className="text-[10px] text-muted-foreground">{player.rollNo}</p>
                            )}
                          </td>
                          <td className="py-2.5 text-center px-2">
                            <span className={cn("font-bold tabular-nums", top3 ? "text-base" : "text-sm")}>{s.score}</span>
                          </td>
                          <td className="py-2.5 text-center px-2 text-xs font-semibold text-green-500">{s.wins}</td>
                          <td className="py-2.5 text-center px-2 text-xs font-semibold text-destructive">{s.losses}</td>
                          <td className="py-2.5 text-center px-2 text-xs font-semibold text-blue-500">{s.draws}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <div className="border-t bg-muted/20 mt-4">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">♟ Chess Club · Chess Pairing</span>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {updated && (
              <span>
                Updated {updated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              <span>Refresh in {cd}s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
