"use client";
/**
 * ONE-TIME SEED PAGE — Antaragini 2026 Tournament
 * ─────────────────────────────────────────────────
 * Visit this page while logged in to seed the data.
 * DELETE /app/seed-antaragini after running once!
 */

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Player } from "@/lib/types";

// ── Tournament date (08/03/2026 20:44:07 IST = DD/MM/YYYY Indian format) ─
const TOURNAMENT_DATE_MS = new Date("2026-03-08T15:14:07.000Z").getTime();

// ── Standings extracted from PNG ──────────────────────────────────────────
const STANDINGS_DATA = [
  { rank: 1,  name: "Omkar Bhagat",       rollNo: "DW236",      branch: "CSE CySec", rating: 1200, score: 5.0, wins: 5, losses: 0, draws: 0, buchholz: 8.0  },
  { rank: 2,  name: "Aditya Yadav",        rollNo: "SA256",      branch: "CE",        rating: 2000, score: 4.0, wins: 4, losses: 1, draws: 0, buchholz: 11.0 },
  { rank: 3,  name: "Omkar Panhale",       rollNo: "09",         branch: "CSE AIML",  rating: null, score: 3.0, wins: 3, losses: 2, draws: 0, buchholz: 12.0 },
  { rank: 4,  name: "Meghraj Jadhav",      rollNo: "SA125",      branch: "CE",        rating: null, score: 2.0, wins: 2, losses: 1, draws: 0, buchholz: 5.0  },
  { rank: 5,  name: "Abhijit Gidde",       rollNo: "DW101",      branch: "CE",        rating: 600,  score: 2.0, wins: 2, losses: 1, draws: 0, buchholz: 4.0  },
  { rank: 6,  name: "Hariom Talekar",      rollNo: "FA512",      branch: "CE",        rating: 800,  score: 1.0, wins: 1, losses: 1, draws: 0, buchholz: 5.0  },
  { rank: 7,  name: "Kartik Ghorpade",     rollNo: "SA121",      branch: "CE",        rating: null, score: 1.0, wins: 1, losses: 1, draws: 0, buchholz: 4.0  },
  { rank: 8,  name: "Vitthal Kadam",       rollNo: "DTC143",     branch: "ENTC",      rating: null, score: 1.0, wins: 1, losses: 1, draws: 0, buchholz: 3.0  },
  { rank: 9,  name: "Aditya Shinde",       rollNo: "DW105",      branch: "CE",        rating: 638,  score: 1.0, wins: 1, losses: 1, draws: 0, buchholz: 2.0  },
  { rank: 10, name: "Rahul Chate",         rollNo: "FA346",      branch: "CE",        rating: null, score: 1.0, wins: 1, losses: 1, draws: 0, buchholz: 2.0  },
  { rank: 11, name: "Abhay Suryawanshi",   rollNo: "FA236",      branch: "CE",        rating: 1123, score: 0.0, wins: 0, losses: 1, draws: 0, buchholz: 5.0  },
  { rank: 12, name: "Kaushal Choudhary",   rollNo: "FA457",      branch: "CE",        rating: null, score: 0.0, wins: 0, losses: 1, draws: 0, buchholz: 4.0  },
  { rank: 13, name: "Atharv Deshmukh",     rollNo: "DW253",      branch: "CSE AIML",  rating: 815,  score: 0.0, wins: 0, losses: 1, draws: 0, buchholz: 3.0  },
  { rank: 14, name: "Om Korake",           rollNo: "DW251",      branch: "IT",        rating: null, score: 0.0, wins: 0, losses: 1, draws: 0, buchholz: 2.0  },
  { rank: 15, name: "Chaitanya Nikhumbh",  rollNo: "DW116",      branch: "CE",        rating: null, score: 0.0, wins: 0, losses: 1, draws: 0, buchholz: 2.0  },
  { rank: 16, name: "Saarthak Shinde",     rollNo: "FA310",      branch: "CE",        rating: 1000, score: 0.0, wins: 0, losses: 1, draws: 0, buchholz: 1.0  },
  { rank: 17, name: "Nipul Rathod",        rollNo: "DW130",      branch: "CE",        rating: 800,  score: 0.0, wins: 0, losses: 1, draws: 0, buchholz: 1.0  },
  { rank: 18, name: "Aditya Kshatriya",    rollNo: "FA356",      branch: "CE",        rating: null, score: 0.0, wins: 0, losses: 1, draws: 0, buchholz: 1.0  },
  { rank: 19, name: "Piyush Lahoti",       rollNo: "25BSCAM10",  branch: "CE",        rating: null, score: 0.0, wins: 0, losses: 1, draws: 0, buchholz: 1.0  },
] as const;

// Manual overrides: PNG name → fragment of DB name (for contains-match)
const MANUAL_MATCHES: Record<string, string> = {
  "Om Korake":          "Om Pradhan Korake",
  "Chaitanya Nikhumbh": "Chaitanya Mangesh Nikumbh",
  "Aditya Kshatriya":   "Aditya Bhanudas Kshatriya",
};

// ── Helpers ───────────────────────────────────────────────────────────────
function rowToPlayer(row: any): Player {
  return {
    id: row.id, name: row.name, rollNo: row.roll_no, branch: row.branch,
    class: row.class, year: row.year ?? undefined, division: row.division ?? undefined,
    estimatedElo: row.estimated_elo ?? undefined, officialElo: row.official_elo ?? undefined,
    fideRating: row.fide_rating ?? undefined, gamesPlayed: row.games_played ?? 0,
    wins: row.wins ?? 0, losses: row.losses ?? 0, draws: row.draws ?? 0,
    isRated: row.is_rated, program: row.program ?? undefined,
    enrollmentNo: row.enrollment_no ?? undefined, mobileNo: row.mobile_no ?? undefined,
    email: row.email ?? undefined, createdAt: row.created_at,
  };
}

function findPlayer(pngName: string, existing: Player[]): Player | undefined {
  // 1. Manual override
  const override = MANUAL_MATCHES[pngName];
  if (override) {
    const m = existing.find(p => p.name.toLowerCase().includes(override.toLowerCase()));
    if (m) return m;
  }
  const lower = pngName.toLowerCase().trim();
  // 2. Exact match
  const exact = existing.find(p => p.name.toLowerCase().trim() === lower);
  if (exact) return exact;
  // 3. DB name contains full PNG name
  const contains = existing.find(p => p.name.toLowerCase().includes(lower));
  if (contains) return contains;
  // 4. First + last word of PNG appears in DB name
  const tokens = lower.split(/\s+/);
  if (tokens.length >= 2) {
    const first = tokens[0], last = tokens[tokens.length - 1];
    const m = existing.find(p => {
      const db = p.name.toLowerCase();
      return db.includes(first) && db.includes(last);
    });
    if (m) return m;
  }
  return undefined;
}

// ── Component ─────────────────────────────────────────────────────────────
type LogEntry = { kind: "ok" | "info" | "warn" | "err"; msg: string };

export default function SeedAntaragini() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [step, setStep] = useState<"idle" | "running" | "done">("idle");

  const push = (kind: LogEntry["kind"], msg: string) =>
    setLog(prev => [...prev, { kind, msg }]);

  const run = async () => {
    setStep("running");
    setLog([]);

    try {
      // ── Auth ──────────────────────────────────────────────────────
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { push("err", "Not logged in. Please log in first."); setStep("idle"); return; }
      push("info", `Logged in as: ${user.email}`);

      // ── Guard: prevent double-seeding ────────────────────────────
      const { data: existingT } = await supabase
        .from("tournaments").select("id,name")
        .eq("user_id", user.id).ilike("name", "%Antaragini%");
      if (existingT && existingT.length > 0) {
        push("err", `Tournament already exists: "${existingT[0].name}" — aborting to prevent duplicates.`);
        push("info", "Delete the existing Antaragini tournament from the app first, then re-run.");
        setStep("idle"); return;
      }

      // ── Fetch existing players ────────────────────────────────────
      const { data: rows, error: fetchErr } = await supabase
        .from("players").select("*").eq("user_id", user.id);
      if (fetchErr) { push("err", `Fetch players failed: ${fetchErr.message}`); setStep("idle"); return; }
      const existing = (rows ?? []).map(rowToPlayer);
      push("info", `Found ${existing.length} players in DB`);

      // ── Match / create players ────────────────────────────────────
      push("info", "— Matching PNG players to DB —");
      const playerIds: string[] = [];

      for (const s of STANDINGS_DATA) {
        const found = findPlayer(s.name, existing);

        if (found) {
          push("ok", `[${s.rank}] ✅ Matched "${s.name}" → DB: "${found.name}" (${found.rollNo})`);
          playerIds.push(found.id);

          const { error: updErr } = await supabase.from("players").update({
            wins:         (found.wins        ?? 0) + s.wins,
            losses:       (found.losses      ?? 0) + s.losses,
            draws:        (found.draws       ?? 0) + s.draws,
            games_played: (found.gamesPlayed ?? 0) + s.wins + s.losses + s.draws,
          }).eq("id", found.id);

          if (updErr) push("warn", `   ⚠ Stats update failed: ${updErr.message}`);
          else push("info", `   Stats: +${s.wins}W / +${s.losses}L / +${s.draws}D`);

        } else {
          push("warn", `[${s.rank}] ➕ New player: "${s.name}" (${s.rollNo}, ${s.branch})`);
          const newId = crypto.randomUUID();
          playerIds.push(newId);

          const { error: insErr } = await supabase.from("players").insert({
            id: newId, user_id: user.id,
            name: s.name, roll_no: s.rollNo, branch: s.branch,
            official_elo: s.rating !== null && s.rating >= 100 ? s.rating : null,
            is_rated: s.rating !== null && s.rating >= 100,
            wins: s.wins, losses: s.losses, draws: s.draws,
            games_played: s.wins + s.losses + s.draws,
            created_at: TOURNAMENT_DATE_MS,
          });

          if (insErr) push("err", `   ❌ Insert failed: ${insErr.message}`);
          else push("ok", `   Created successfully (rating: ${s.rating ?? "NR"})`);
        }
      }

      // ── Create tournament record ───────────────────────────────────
      push("info", "— Creating tournament record —");
      const tournamentId = crypto.randomUUID();

      const { error: tErr } = await supabase.from("tournaments").insert({
        id: tournamentId, user_id: user.id,
        name: "Chess Tournament - Antaragini 2026",
        description: "Annual day chess tournament hosted at G.H. Raisoni International Skill Tech University, Pune. 19 participants, 5-round Swiss.",
        format: "Swiss", status: "completed",
        rounds: 5, current_round: 5,
        players: playerIds, byes: [],
        time_controls: {}, bye_history: {},
        start_date: TOURNAMENT_DATE_MS,
        end_date:   TOURNAMENT_DATE_MS,
        created_at: TOURNAMENT_DATE_MS,
      });

      if (tErr) { push("err", `Tournament insert failed: ${tErr.message}`); setStep("idle"); return; }
      push("ok", `Tournament created (ID: ${tournamentId})`);

      // ── Create standings ───────────────────────────────────────────
      push("info", "— Inserting standings —");
      let standingErrors = 0;

      for (let i = 0; i < STANDINGS_DATA.length; i++) {
        const s = STANDINGS_DATA[i];
        const { error: stErr } = await supabase.from("standings").upsert({
          player_id:    playerIds[i],
          tournament_id: tournamentId,
          user_id:      user.id,
          score:        s.score,
          buchholz:     s.buchholz,
          rating:       s.rating ?? 0,
          wins:         s.wins,
          losses:       s.losses,
          draws:        s.draws,
          games_played: s.wins + s.losses + s.draws,
        }, { onConflict: "player_id,tournament_id" });

        if (stErr) { push("warn", `Standing ${s.rank} (${s.name}): ${stErr.message}`); standingErrors++; }
      }

      if (standingErrors === 0) push("ok", `All ${STANDINGS_DATA.length} standings inserted`);
      else push("warn", `${standingErrors} standings had errors`);

      push("ok", "");
      push("ok", "🎉 SEED COMPLETE! The tournament is now visible in the app.");
      push("info", "→ Next step: delete /app/seed-antaragini from the codebase.");
      setStep("done");

    } catch (e: any) {
      push("err", `Unexpected error: ${e?.message ?? String(e)}`);
      setStep("idle");
    }
  };

  const COLOR = {
    ok:   "text-green-400",
    info: "text-gray-300",
    warn: "text-yellow-400",
    err:  "text-red-400",
  } as const;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">🌱 Seed: Antaragini 2026 Tournament</h1>
          <p className="text-gray-400 mt-1">
            Adds the past tournament record, 19 standings, and W/L/D stats to all participating players.
            New players not currently in the DB are registered automatically.
          </p>
          <div className="mt-2 bg-amber-900/30 border border-amber-600/40 rounded-lg px-4 py-2 text-amber-300 text-sm">
            ⚠ Run this <strong>once only</strong>. Delete the page after. A guard prevents double-seeding.
          </div>
        </div>

        {/* Preview table */}
        <div className="border border-gray-700 rounded-lg overflow-hidden">
          <div className="bg-gray-800/60 px-4 py-2 text-sm font-medium text-gray-300">
            Data to seed — Chess Tournament · Antaragini 2026 · 19 players · 5-round Swiss · 08 Mar 2026
          </div>
          <div className="overflow-auto max-h-72">
            <table className="w-full text-xs">
              <thead className="bg-gray-800 sticky top-0">
                <tr className="text-gray-400">
                  {["Rank","Name","Roll No","Branch","Rating","Score","W/L/D","Buchholz"].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STANDINGS_DATA.map(s => (
                  <tr key={s.rank} className="border-t border-gray-800 hover:bg-gray-800/40">
                    <td className="px-3 py-1.5 text-gray-400">{s.rank}</td>
                    <td className="px-3 py-1.5 font-medium">{s.name}</td>
                    <td className="px-3 py-1.5 text-gray-400 font-mono text-xs">{s.rollNo}</td>
                    <td className="px-3 py-1.5 text-gray-400">{s.branch}</td>
                    <td className="px-3 py-1.5">{s.rating ?? <span className="text-gray-600">NR</span>}</td>
                    <td className="px-3 py-1.5 font-semibold">{s.score}</td>
                    <td className="px-3 py-1.5">
                      <span className="text-green-400">{s.wins}W</span>
                      <span className="text-gray-400"> / </span>
                      <span className="text-red-400">{s.losses}L</span>
                      <span className="text-gray-400"> / </span>
                      <span className="text-blue-400">{s.draws}D</span>
                    </td>
                    <td className="px-3 py-1.5 text-gray-400">{s.buchholz}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action button */}
        {step !== "done" && (
          <button
            onClick={run}
            disabled={step === "running"}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              step === "running"
                ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-500 text-white"
            }`}
          >
            {step === "running" ? "⏳ Running…" : "▶ Run Seed"}
          </button>
        )}

        {/* Log output */}
        {log.length > 0 && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 font-mono text-xs space-y-0.5 max-h-80 overflow-y-auto">
            {log.map((l, i) => (
              <div key={i} className={COLOR[l.kind]}>{l.msg || <br />}</div>
            ))}
          </div>
        )}

        {step === "done" && (
          <div className="bg-green-900/30 border border-green-600/40 rounded-lg px-4 py-3 text-green-300">
            ✅ Done! Go to <a href="/tournaments" className="underline">/tournaments</a> to see "Chess Tournament - Antaragini 2026".<br />
            Then go to <a href="/players" className="underline">/players</a> to verify W/L/D stats are updated.<br />
            <strong>Remember to delete /app/seed-antaragini from your codebase!</strong>
          </div>
        )}
      </div>
    </div>
  );
}
