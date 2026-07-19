"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ── Interval between auto-refreshes (seconds) ─────────────────
const REFRESH = 30;

// ── Row mappers (no hook dependency needed) ────────────────────
function mapT(r: any) {
  return {
    id: r.id as string, name: r.name as string,
    description: r.description as string | undefined,
    format: r.format as string, status: r.status as string,
    rounds: r.rounds as number, currentRound: (r.current_round ?? 0) as number,
    players: (r.players ?? []) as string[],
    startDate: r.start_date as number | undefined,
  };
}
function mapP(r: any) {
  return {
    id: r.id as string, name: r.name as string,
    rollNo: (r.roll_no ?? "") as string, branch: (r.branch ?? "") as string,
    officialElo: r.official_elo as number | null,
    estimatedElo: r.estimated_elo as number | null,
    fideRating: r.fide_rating as number | null,
  };
}
function mapPa(r: any) {
  return {
    id: r.id as string, roundNumber: r.round_number as number,
    player1Id: r.player1_id as string, player2Id: r.player2_id as string | undefined,
    result: r.result as "win1" | "win2" | "draw" | undefined,
    isBye: r.is_bye as boolean, createdAt: (r.created_at ?? 0) as number,
  };
}
function mapSt(r: any) {
  return {
    playerId: r.player_id as string,
    score: Number(r.score), buchholz: Number(r.buchholz),
    wins: (r.wins ?? 0) as number, losses: (r.losses ?? 0) as number,
    draws: (r.draws ?? 0) as number, gamesPlayed: (r.games_played ?? 0) as number,
  };
}

type TRec  = ReturnType<typeof mapT>;
type PRec  = ReturnType<typeof mapP>;
type PaRec = ReturnType<typeof mapPa>;
type StRec = ReturnType<typeof mapSt>;

function rating(p: PRec | undefined): string {
  if (!p) return "NR";
  const v = p.officialElo ?? p.fideRating ?? p.estimatedElo ?? null;
  return v && v >= 100 ? String(v) : "NR";
}

const STATUS_COLOR: Record<string, string> = {
  "planning": "#94a3b8", "in-progress": "#22c55e",
  "completed": "#f59e0b", "upcoming": "#60a5fa",
};

// ── Loading skeleton ───────────────────────────────────────────
function Loading() {
  return (
    <div style={S.root}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", color: "#f59e0b" }}>
        <span style={{ fontSize: "3rem" }}>♛</span>
        <span style={{ color: "#94a3b8" }}>Loading tournament…</span>
      </div>
    </div>
  );
}

// ── Error card ────────────────────────────────────────────────
function ErrorCard({ msg }: { msg: string }) {
  return (
    <div style={S.root}>
      <div style={{ textAlign: "center", maxWidth: 520, padding: "2rem" }}>
        <span style={{ fontSize: "2.5rem" }}>♟</span>
        <h1 style={{ color: "#f1f5f9", fontSize: "1.4rem", margin: "0.75rem 0 0.4rem" }}>
          Unable to Load Tournament
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "0.875rem", marginBottom: "1.5rem" }}>{msg}</p>
        <div style={{
          background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
          borderRadius: "0.5rem", padding: "1rem", textAlign: "left",
        }}>
          <p style={{ color: "#fde68a", fontWeight: 600, fontSize: "0.85rem", margin: "0 0 0.4rem" }}>
            To enable public access:
          </p>
          <p style={{ color: "#94a3b8", fontSize: "0.8rem", margin: 0 }}>
            Run the <b>public_display_sql</b> script in your Supabase dashboard SQL editor, then refresh this page.
          </p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
export default function DisplayPage() {
  const { id } = useParams<{ id: string }>();

  const [t, setT]       = useState<TRec | null>(null);
  const [pl, setPl]     = useState<PRec[]>([]);
  const [pa, setPa]     = useState<PaRec[]>([]);
  const [st, setSt]     = useState<StRec[]>([]);
  const [err, setErr]   = useState<string | null>(null);
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

    setUpdated(new Date()); setCd(REFRESH); setErr(null); setLoading(false);
  }, [id]);

  useEffect(() => { fetchAll(); const iv = setInterval(fetchAll, REFRESH * 1000); return () => clearInterval(iv); }, [fetchAll]);
  useEffect(() => { const iv = setInterval(() => setCd(v => Math.max(0, v - 1)), 1000); return () => clearInterval(iv); }, []);
  useEffect(() => { const iv = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(iv); }, []);

  const plMap     = useMemo(() => new Map(pl.map(p => [p.id, p])), [pl]);
  const roundPa   = useMemo(() => pa.filter(p => p.roundNumber === round).sort((a, b) => a.createdAt - b.createdAt), [pa, round]);
  const sortedSt  = useMemo(() => [...st].sort((a, b) => b.score - a.score || b.buchholz - a.buchholz), [st]);
  const done      = roundPa.filter(p => p.result || p.isBye).length;

  if (loading) return <Loading />;
  if (err || !t)  return <ErrorCard msg={err ?? "Unknown error"} />;

  const maxRound = Math.max(t.rounds, t.currentRound);

  return (
    <div style={S.root}>
      {/* ── HEADER ──────────────────────────────────────── */}
      <header style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", minWidth: 0 }}>
          {/* LIVE pill */}
          <div style={S.livePill}>
            <span style={S.liveDot} />
            <span style={{ color: "#ef4444", fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.12em" }}>LIVE</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ color: "#f59e0b", fontSize: "1.6rem", lineHeight: 1 }}>♛</span>
              <h1 style={{ fontSize: "clamp(1.1rem, 2.2vw, 1.9rem)", fontWeight: 800, color: "#f8fafc", margin: 0, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.name}
              </h1>
            </div>
            <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", marginTop: "0.2rem", flexWrap: "wrap" }}>
              <Chip color="#94a3b8">{t.format}</Chip>
              <Chip color={STATUS_COLOR[t.status] ?? "#94a3b8"} glow>{t.status.replace("-", " ")}</Chip>
              <Chip color="#94a3b8">{pl.length} players</Chip>
              {t.startDate && <Chip color="#64748b">{new Date(t.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</Chip>}
            </div>
          </div>
        </div>
        {/* Clock */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "clamp(1.1rem, 1.8vw, 1.6rem)", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#f8fafc", letterSpacing: "0.04em" }}>
            {clock.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#4b5563" }}>
            {clock.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>
      </header>

      {/* ── ROUND BAR ────────────────────────────────────── */}
      <div style={S.roundBar}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button style={{ ...S.navBtn, opacity: round <= 1 ? 0.3 : 1 }} disabled={round <= 1} onClick={() => setRound(r => r - 1)}>‹</button>
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: "1rem", fontWeight: 800, color: "#f59e0b", letterSpacing: "0.05em" }}>ROUND {round}</span>
            <span style={{ color: "#374151", margin: "0 0.35rem" }}>/</span>
            <span style={{ fontSize: "1rem", color: "#94a3b8" }}>{t.rounds}</span>
            {round === t.currentRound && (
              <span style={{ ...S.badge, marginLeft: "0.6rem", color: "#22c55e", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
                Current Round
              </span>
            )}
          </div>
          <button style={{ ...S.navBtn, opacity: round >= maxRound ? 0.3 : 1 }} disabled={round >= maxRound} onClick={() => setRound(r => r + 1)}>›</button>
        </div>

        {/* Progress bar */}
        {roundPa.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{done}/{roundPa.length} boards done</span>
            <div style={{ width: 80, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${(done / roundPa.length) * 100}%`, height: "100%", background: "#22c55e", borderRadius: 2, transition: "width 0.5s ease" }} />
            </div>
          </div>
        )}
      </div>

      {/* ── MAIN ─────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* Left: Pairings */}
        <div style={{ flex: "0 0 56%", display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
          <SectionLabel>Round {round} Pairings</SectionLabel>
          <div style={{ flex: 1, overflowY: "auto", padding: "0.875rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {roundPa.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "#374151" }}>
                <div style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>♟</div>
                <p style={{ margin: 0 }}>No pairings for Round {round} yet</p>
              </div>
            ) : roundPa.map((pairing, idx) => (
              <BoardCard key={pairing.id} pairing={pairing} boardNum={idx + 1} plMap={plMap} />
            ))}
          </div>
        </div>

        {/* Right: Standings */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <SectionLabel>Standings</SectionLabel>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, background: "#0a0c0f", zIndex: 1 }}>
                  {(["#", "Player", "Score", "W", "L", "D", "Bkh"] as const).map(h => (
                    <th key={h} style={{ padding: "0.65rem 0.75rem", textAlign: h === "Player" ? "left" : "center", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", color: "#4b5563", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedSt.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "#374151", fontSize: "0.9rem" }}>No standings yet</td></tr>
                ) : sortedSt.map((s, i) => {
                  const p = plMap.get(s.playerId);
                  const top = i < 3;
                  const rankColors = ["#fbbf24", "#94a3b8", "#cd7c3e"];
                  return (
                    <tr key={s.playerId} style={{ borderBottom: "1px solid rgba(255,255,255,0.025)", background: top ? `rgba(245,158,11,${0.06 - i * 0.018})` : "transparent" }}>
                      <td style={{ padding: "0.55rem 0.75rem", textAlign: "center" }}>
                        <span style={{ fontSize: top ? "1rem" : "0.8rem", fontWeight: 700, color: top ? rankColors[i] : "#374151" }}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                        </span>
                      </td>
                      <td style={{ padding: "0.55rem 0.75rem" }}>
                        <p style={{ fontSize: "clamp(0.78rem, 0.9vw, 0.92rem)", fontWeight: top ? 600 : 400, color: top ? "#f8fafc" : "#cbd5e1", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "12rem" }}>
                          {p?.name ?? "Unknown"}
                        </p>
                        {p?.rollNo && <p style={{ fontSize: "0.65rem", color: "#374151", margin: "0.05rem 0 0" }}>{p.rollNo}</p>}
                      </td>
                      <td style={{ padding: "0.55rem 0.75rem", textAlign: "center" }}>
                        <span style={{ fontSize: top ? "1.1rem" : "0.9rem", fontWeight: 800, color: top ? "#fbbf24" : "#f1f5f9" }}>{s.score}</span>
                      </td>
                      <td style={{ textAlign: "center", fontSize: "0.8rem", color: "#22c55e", fontWeight: 600, padding: "0 0.3rem" }}>{s.wins}</td>
                      <td style={{ textAlign: "center", fontSize: "0.8rem", color: "#ef4444", fontWeight: 600, padding: "0 0.3rem" }}>{s.losses}</td>
                      <td style={{ textAlign: "center", fontSize: "0.8rem", color: "#60a5fa", fontWeight: 600, padding: "0 0.3rem" }}>{s.draws}</td>
                      <td style={{ textAlign: "center", fontSize: "0.7rem", color: "#4b5563", padding: "0 0.5rem" }}>{s.buchholz}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer style={S.footer}>
        <span style={{ fontSize: "0.72rem", color: "#374151" }}>♟ Chess Club · Powered by Chess Pairing</span>
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          {updated && (
            <span style={{ fontSize: "0.72rem", color: "#374151" }}>
              Updated {updated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
            <span style={{ fontSize: "0.72rem", color: "#4b5563" }}>Refresh in {cd}s</span>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}
      `}</style>
    </div>
  );
}

// ── BoardCard ─────────────────────────────────────────────────
function BoardCard({ pairing, boardNum, plMap }: { pairing: PaRec; boardNum: number; plMap: Map<string, PRec> }) {
  const p1 = plMap.get(pairing.player1Id);
  const p2 = pairing.player2Id ? plMap.get(pairing.player2Id) : undefined;
  const isP1Win = pairing.result === "win1";
  const isP2Win = pairing.result === "win2";
  const isDraw  = pairing.result === "draw";
  const pending = !pairing.result && !pairing.isBye;

  const resultBadge = () => {
    if (pairing.isBye) return { text: "BYE · +1 pt", color: "#f59e0b" };
    if (!pairing.result) return { text: "● Ongoing", color: "#f59e0b" };
    if (isDraw) return { text: "½–½  Draw", color: "#60a5fa" };
    return { text: isP1Win ? "1–0  White Wins" : "0–1  Black Wins", color: "#22c55e" };
  };
  const rb = resultBadge();

  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: `1px solid ${pending ? "rgba(245,158,11,0.22)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: "0.625rem",
      padding: "0.75rem 1rem",
    }}>
      {/* Top row: board + result */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", color: "#4b5563", textTransform: "uppercase" }}>Board {boardNum}</span>
        <span style={{ fontSize: "0.72rem", fontWeight: 600, color: rb.color, background: `${rb.color}16`, border: `1px solid ${rb.color}35`, borderRadius: 999, padding: "0.1rem 0.55rem", animation: pending ? "livePulse 2s infinite" : "none" }}>
          {rb.text}
        </span>
      </div>

      {pairing.isBye ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <PlayerCell p={p1} side="white" bold={false} />
          <div style={{ color: "#f59e0b", fontSize: "1.2rem", flex: "0 0 auto", padding: "0 0.5rem" }}>⭐</div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <PlayerCell p={p1} side="white" bold={isP1Win} win={isP1Win} draw={isDraw} />
          {/* Score column */}
          <div style={{ flexShrink: 0, width: "2.5rem", textAlign: "center" }}>
            {pairing.result ? (
              <>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: isP1Win ? "#4ade80" : isDraw ? "#60a5fa" : "#ef4444", lineHeight: 1.1 }}>{isDraw ? "½" : isP1Win ? "1" : "0"}</div>
                <div style={{ fontSize: "0.6rem", color: "#374151" }}>—</div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: isP2Win ? "#4ade80" : isDraw ? "#60a5fa" : "#ef4444", lineHeight: 1.1 }}>{isDraw ? "½" : isP2Win ? "1" : "0"}</div>
              </>
            ) : (
              <span style={{ fontSize: "0.75rem", color: "#374151" }}>vs</span>
            )}
          </div>
          <PlayerCell p={p2} side="black" bold={isP2Win} win={isP2Win} draw={isDraw} right />
        </div>
      )}
    </div>
  );
}

function PlayerCell({ p, side, bold, win, draw, right }: { p?: PRec; side: "white" | "black"; bold: boolean; win?: boolean; draw?: boolean; right?: boolean }) {
  const winColor = win ? "#4ade80" : draw ? "#60a5fa" : undefined;
  return (
    <div style={{
      flex: 1, padding: "0.4rem 0.6rem", borderRadius: "0.4rem", textAlign: right ? "right" : "left",
      background: win ? "rgba(34,197,94,0.07)" : draw ? "rgba(96,165,250,0.06)" : "transparent",
      border: `1px solid ${win ? "rgba(34,197,94,0.18)" : draw ? "rgba(96,165,250,0.14)" : "transparent"}`,
    }}>
      <p style={{ fontSize: "clamp(0.78rem, 1vw, 0.95rem)", fontWeight: bold ? 700 : 400, color: winColor ?? "#e2e8f0", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {right && win && <span style={{ marginRight: "0.3rem" }}>✓</span>}
        {p?.name ?? "Unknown"}
        {!right && win && <span style={{ marginLeft: "0.3rem" }}>✓</span>}
      </p>
      <p style={{ fontSize: "0.68rem", color: "#4b5563", margin: "0.05rem 0 0" }}>
        {side === "white" ? "⬜" : "⬛"} {p?.branch ?? "—"}
        {p && <span style={{ color: "#64748b" }}> · {p.officialElo ?? p.fideRating ?? p.estimatedElo ? String(p.officialElo ?? p.fideRating ?? p.estimatedElo) : "NR"}</span>}
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "0.55rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.015)", flexShrink: 0 }}>
      <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", color: "#4b5563", textTransform: "uppercase" }}>{children}</span>
    </div>
  );
}

function Chip({ children, color, glow }: { children: React.ReactNode; color: string; glow?: boolean }) {
  return (
    <span style={{
      fontSize: "0.7rem", fontWeight: 600, color,
      background: `${color}12`, border: `1px solid ${color}30`,
      borderRadius: 999, padding: "0.1rem 0.5rem",
      textTransform: "capitalize",
      boxShadow: glow ? `0 0 8px ${color}30` : "none",
    }}>{children}</span>
  );
}

// ── Shared styles ──────────────────────────────────────────────
const S = {
  root: {
    background: "#0a0c0f", minHeight: "100vh", display: "flex",
    flexDirection: "column" as const, color: "#f1f5f9",
    fontFamily: "'Inter', system-ui, sans-serif", overflow: "hidden",
    alignItems: undefined as any,
    justifyContent: undefined as any,
  },
  rootCenter: {
    background: "#0a0c0f", minHeight: "100vh", display: "flex",
    flexDirection: "column" as const, color: "#f1f5f9",
    fontFamily: "'Inter', system-ui, sans-serif",
    alignItems: "center", justifyContent: "center",
  },
  header: {
    background: "linear-gradient(135deg, #1c1400 0%, #0d0f0b 100%)",
    borderBottom: "1px solid rgba(245,158,11,0.15)",
    padding: "0.875rem 1.5rem",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: "1rem", flexShrink: 0,
  },
  roundBar: {
    background: "rgba(255,255,255,0.018)",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    padding: "0.5rem 1.5rem",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    flexShrink: 0,
  },
  footer: {
    background: "rgba(0,0,0,0.55)",
    borderTop: "1px solid rgba(255,255,255,0.04)",
    padding: "0.45rem 1.5rem",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    flexShrink: 0,
  },
  livePill: {
    display: "flex", alignItems: "center", gap: "0.35rem",
    background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)",
    borderRadius: 999, padding: "0.2rem 0.6rem", flexShrink: 0,
  },
  liveDot: {
    width: 7, height: 7, borderRadius: "50%", background: "#ef4444",
    animation: "livePulse 1.5s infinite",
    display: "inline-block",
  } as React.CSSProperties,
  navBtn: {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "0.35rem", padding: "0.2rem 0.55rem",
    color: "#f1f5f9", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1,
  } as React.CSSProperties,
  badge: {
    fontSize: "0.67rem", fontWeight: 600, borderRadius: 999,
    padding: "0.1rem 0.5rem",
  } as React.CSSProperties,
};
