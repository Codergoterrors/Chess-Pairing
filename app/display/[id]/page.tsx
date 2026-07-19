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
const REFRESH = 5;

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
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* LIVE pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500/20 to-red-500/10 border border-red-500/40 shrink-0 mt-0.5 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[11px] font-bold text-red-400 tracking-widest uppercase">Live</span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold tracking-tight leading-tight truncate bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">{t.name}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/40 font-medium">{t.format}</Badge>
                <Badge
                  className={cn(
                    "font-medium border",
                    t.status === "in-progress" && "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
                    t.status === "completed"   && "bg-amber-500/20 text-amber-300 border-amber-500/40",
                    t.status === "planning"    && "bg-slate-500/20 text-slate-300 border-slate-500/40",
                  )}
                >
                  {t.status.replace("-", " ")}
                </Badge>
                <span className="text-sm text-muted-foreground font-medium">{pl.length} players</span>
                <span className="text-muted-foreground/50">·</span>
                <span className="text-sm text-muted-foreground font-medium">{t.rounds} rounds</span>
                {t.startDate && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="text-sm text-muted-foreground font-medium">
                      {new Date(t.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Clock */}
          <div className="text-right shrink-0 bg-gradient-to-br from-primary/10 to-primary/5 px-4 py-2.5 rounded-lg border border-primary/20">
            <p className="text-2xl font-bold tabular-nums tracking-tight text-primary">
              {clock.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {clock.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long" })}
            </p>
          </div>
        </div>
      </header>

      {/* ── ROUND SELECTOR ─────────────────────────────────── */}
      <div className="border-b bg-gradient-to-r from-muted/40 to-muted/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline" size="icon"
              className="h-8 w-8 hover:bg-primary/20 hover:border-primary/40 transition-colors"
              disabled={round <= 1}
              onClick={() => setRound(r => r - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm">
              <span className="font-bold text-lg">Round <span className="text-primary">{round}</span></span>
              <span className="text-muted-foreground"> / {t.rounds}</span>
              {isCurrent && (
                <Badge className="ml-3 text-xs py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">Current Round</Badge>
              )}
            </div>
            <Button
              variant="outline" size="icon"
              className="h-8 w-8 hover:bg-primary/20 hover:border-primary/40 transition-colors"
              disabled={round >= maxRound}
              onClick={() => setRound(r => r + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {roundPa.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50">
                <span className="text-xs font-semibold text-muted-foreground">{done}/{roundPa.length} complete</span>
                <div className="w-24 h-2 bg-muted/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-500 shadow-lg shadow-emerald-500/20"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CHAMPIONS PODIUM (tournament completed) ─────────── */}
      {t.status === "completed" && sortedSt.length >= 1 && (() => {
        const gold   = sortedSt[0] ? plMap.get(sortedSt[0].playerId) : undefined;
        const silver = sortedSt[1] ? plMap.get(sortedSt[1].playerId) : undefined;
        const bronze = sortedSt[2] ? plMap.get(sortedSt[2].playerId) : undefined;

        type PodiumCardProps = {
          rank: 1 | 2 | 3;
          player: ReturnType<typeof mapP> | undefined;
          score: number;
        };

        const PodiumCard = ({ rank, player, score }: PodiumCardProps) => {
          const styles = {
            1: {
              medal: "🏆",
              cardCls: "border-yellow-500/40 bg-gradient-to-b from-yellow-500/10 to-transparent shadow-lg shadow-yellow-500/10",
              barCls: "bg-yellow-500/15 border-yellow-500/30",
              barH: "h-24",
              numCls: "text-yellow-400",
              nameCls: "text-yellow-300 text-2xl",
              scoreCls: "text-yellow-400 text-3xl",
            },
            2: {
              medal: "🥈",
              cardCls: "border-slate-400/30 bg-gradient-to-b from-slate-400/8 to-transparent",
              barCls: "bg-slate-500/15 border-slate-400/30",
              barH: "h-16",
              numCls: "text-slate-400",
              nameCls: "text-slate-300 text-xl",
              scoreCls: "text-slate-400 text-2xl",
            },
            3: {
              medal: "🥉",
              cardCls: "border-amber-700/30 bg-gradient-to-b from-amber-700/8 to-transparent",
              barCls: "bg-amber-800/15 border-amber-700/30",
              barH: "h-12",
              numCls: "text-amber-700",
              nameCls: "text-amber-600 text-xl",
              scoreCls: "text-amber-700 text-2xl",
            },
          } as const;
          const s = styles[rank];

          return (
            <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
              <span className={rank === 1 ? "text-5xl" : "text-4xl"}>{s.medal}</span>
              <Card className={cn("w-full", s.cardCls)}>
                <CardContent className={cn("text-center", rank === 1 ? "p-5" : "p-4")}>
                  <p className={cn("font-bold truncate", s.nameCls)}>{player?.name ?? "—"}</p>
                  {player?.branch && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{player.branch}</p>
                  )}
                  <p className={cn("font-bold tabular-nums mt-2", s.scoreCls)}>{score}</p>
                  <p className="text-xs text-muted-foreground">pts</p>
                </CardContent>
              </Card>
              <div className={cn("w-full rounded-t-lg border flex items-center justify-center", s.barH, s.barCls)}>
                <span className={cn("font-black text-3xl", s.numCls)}>{rank}</span>
              </div>
            </div>
          );
        };

        return (
          <div className="border-b bg-gradient-to-b from-card/60 to-transparent">
            <div className="container mx-auto px-4 py-8 flex flex-col items-center gap-6">
              {/* Congratulations header */}
              <div className="text-center space-y-1">
                <p className="text-5xl mb-2">🎉</p>
                <h2 className="text-3xl font-bold tracking-tight">Tournament Complete!</h2>
                <p className="text-muted-foreground text-base">
                  Congratulations to all participants of <span className="font-semibold text-foreground">{t.name}</span>
                </p>
              </div>

              {/* Podium — order: 2nd | 1st | 3rd */}
              <div className="flex items-end justify-center gap-4 w-full max-w-2xl">
                {silver ? (
                  <PodiumCard rank={2} player={silver} score={sortedSt[1].score} />
                ) : <div className="flex-1" />}

                <PodiumCard rank={1} player={gold} score={sortedSt[0].score} />

                {bronze ? (
                  <PodiumCard rank={3} player={bronze} score={sortedSt[2].score} />
                ) : <div className="flex-1" />}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MAIN CONTENT ───────────────────────────────────── */}
      <div className="flex-1 container mx-auto px-4 py-6 min-h-0">
        <div className="flex gap-6" style={{ minHeight: "calc(100vh - 220px)" }}>

          {/* Pairings panel */}
          <div className="flex-[3] flex flex-col gap-4 overflow-y-auto pr-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-1 bg-gradient-to-b from-primary to-primary/60 rounded-full" />
              <p className="text-sm font-bold text-foreground uppercase tracking-wider">
                Round {round} Pairings
              </p>
            </div>

            {roundPa.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="pt-12 pb-12 flex flex-col items-center gap-3 text-center">
                  <Trophy className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-muted-foreground font-medium">No pairings for Round {round} yet</p>
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
                  className={cn(
                    "border transition-all hover:shadow-lg",
                    pending && "border-primary/40 bg-primary/5 shadow-md shadow-primary/10"
                  )}
                >
                  <CardContent className="p-5">
                    {/* Board header */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        Board #{idx + 1}
                      </span>
                      {pairing.isBye ? (
                        <Badge className="bg-gradient-to-r from-amber-500/80 to-amber-600/80 text-white font-semibold shadow-md">BYE · +1 point</Badge>
                      ) : pairing.result ? (
                        <Badge className={cn(
                          "font-bold shadow-md",
                          isDraw ? "bg-gradient-to-r from-blue-500/80 to-blue-600/80 text-white" : 
                          "bg-gradient-to-r from-emerald-500/80 to-green-600/80 text-white"
                        )}>
                          {isDraw ? "½–½ Draw" : isP1Win ? "1–0 White Wins" : "0–1 Black Wins"}
                        </Badge>
                      ) : (
                        <Badge className="animate-pulse bg-primary/20 text-primary border border-primary/40 font-semibold">
                          ● Ongoing
                        </Badge>
                      )}
                    </div>

                    {pairing.isBye ? (
                      <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-amber-400/5 border border-amber-500/30">
                        <div className="flex-1">
                          <p className="font-bold text-base">{p1?.name ?? "Unknown"}</p>
                          <p className="text-xs text-muted-foreground mt-1">{p1?.rollNo} · {p1?.branch} · {elo(p1)}</p>
                        </div>
                        <span className="text-amber-400 text-2xl">⭐</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        {/* Player 1 */}
                        <div className={cn(
                          "flex-1 p-4 rounded-xl transition-all border",
                          isP1Win && "bg-gradient-to-br from-emerald-500/15 to-emerald-400/5 border-emerald-500/40 shadow-md shadow-emerald-500/10",
                          isDraw  && "bg-gradient-to-br from-blue-500/15 to-blue-400/5 border-blue-500/40 shadow-md shadow-blue-500/10",
                          !pairing.result && "bg-muted/40 border-border/70",
                        )}>
                          <p className={cn("font-bold text-sm leading-snug", isP1Win ? "text-emerald-300" : "")}>
                            {p1?.name ?? "Unknown"}
                            {isP1Win && " ✓"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            ⬜ {p1?.branch} · <span className="font-semibold text-foreground">{elo(p1)}</span>
                          </p>
                        </div>

                        {/* Score */}
                        <div className="w-12 text-center shrink-0 flex flex-col items-center justify-center">
                          {pairing.result ? (
                            <div className="space-y-1 bg-muted/50 px-2.5 py-2 rounded-lg border border-border/50">
                              <p className={cn("text-base font-bold leading-none", isP1Win ? "text-emerald-400" : isDraw ? "text-blue-400" : "text-red-400")}>
                                {isDraw ? "½" : isP1Win ? "1" : "0"}
                              </p>
                              <p className="text-[9px] text-muted-foreground font-semibold">—</p>
                              <p className={cn("text-base font-bold leading-none", isP2Win ? "text-emerald-400" : isDraw ? "text-blue-400" : "text-red-400")}>
                                {isDraw ? "½" : isP2Win ? "1" : "0"}
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground font-semibold">vs</p>
                          )}
                        </div>

                        {/* Player 2 */}
                        <div className={cn(
                          "flex-1 p-4 rounded-xl transition-all border text-right",
                          isP2Win && "bg-gradient-to-br from-emerald-500/15 to-emerald-400/5 border-emerald-500/40 shadow-md shadow-emerald-500/10",
                          isDraw  && "bg-gradient-to-br from-blue-500/15 to-blue-400/5 border-blue-500/40 shadow-md shadow-blue-500/10",
                          !pairing.result && "bg-muted/40 border-border/70",
                        )}>
                          <p className={cn("font-bold text-sm leading-snug", isP2Win ? "text-emerald-300" : "")}>
                            {isP2Win && "✓ "}
                            {p2?.name ?? "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-semibold text-foreground">{elo(p2)}</span> · {p2?.branch} ⬛
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
          <div className="flex-[2] overflow-y-auto pr-2">
            <Card className="sticky top-0 border-border/80 shadow-lg">
              <CardHeader className="pb-3 pt-5 px-5 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-1 bg-gradient-to-b from-primary to-primary/60 rounded-full" />
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Standings
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      {["#", "Player", "Pts", "W", "L", "D"].map(h => (
                        <th key={h} className={cn(
                          "py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest",
                          h === "Player" ? "text-left px-4" : "text-center px-2",
                        )}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSt.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-xs font-medium">No standings yet</td></tr>
                    ) : sortedSt.map((s, i) => {
                      const player = plMap.get(s.playerId);
                      const top3 = i < 3;
                      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                      return (
                        <tr key={s.playerId} className={cn(
                          "border-b border-border/30 transition-all hover:bg-muted/50",
                          top3 && "bg-gradient-to-r from-amber-500/8 to-amber-400/3",
                        )}>
                          <td className="py-3 text-center px-2">
                            {medal
                              ? <span className="text-lg">{medal}</span>
                              : <span className="text-xs text-muted-foreground font-bold">{i + 1}</span>
                            }
                          </td>
                          <td className="py-3 px-4">
                            <p className={cn("leading-tight truncate max-w-[11rem]", top3 ? "font-bold text-foreground" : "font-medium text-sm")}>
                              {player?.name ?? "Unknown"}
                            </p>
                            {player?.rollNo && (
                              <p className="text-[10px] text-muted-foreground font-medium">{player.rollNo}</p>
                            )}
                          </td>
                          <td className="py-3 text-center px-2">
                            <span className={cn("font-bold tabular-nums", top3 ? "text-base text-foreground" : "text-sm")}>{s.score}</span>
                          </td>
                          <td className="py-3 text-center px-2 text-xs font-bold text-emerald-400">{s.wins}</td>
                          <td className="py-3 text-center px-2 text-xs font-bold text-red-400">{s.losses}</td>
                          <td className="py-3 text-center px-2 text-xs font-bold text-blue-400">{s.draws}</td>
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
      <div className="border-t border-border/50 bg-gradient-to-r from-muted/30 to-muted/10 mt-6">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">♟ Chess Club · Chess Pairing</span>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            {updated && (
              <span className="font-medium">
                Updated {updated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-emerald-300">Refresh in {cd}s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
