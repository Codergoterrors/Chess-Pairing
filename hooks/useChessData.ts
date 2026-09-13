"use client";

import { useState, useCallback, useEffect } from "react";
import { Player, Tournament, Pairing, Standing } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatPlayerName } from "@/lib/utils-chess";
import { NSD_TOURNAMENT, NSD_PAIRINGS, NSD_STANDINGS } from "@/lib/national-sports-day-tournament";

// ── DB row → app type mappers ────────────────────────────────────────────────
function rowToPlayer(row: any): Player {
  return {
    id: row.id,
    name: formatPlayerName(row.name),
    rollNo: row.roll_no,
    branch: row.branch,
    class: row.class,
    year: row.year ?? undefined,
    division: row.division ?? undefined,
    estimatedElo: row.estimated_elo ?? undefined,
    officialElo: row.official_elo ?? undefined,
    fideRating: row.fide_rating ?? undefined,
    gamesPlayed: row.games_played,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    isRated: row.is_rated,
    program: row.program ?? undefined,
    enrollmentNo: row.enrollment_no ?? undefined,
    mobileNo: row.mobile_no ?? undefined,
    email: row.email ?? undefined,
    createdAt: row.created_at,
  };
}

function playerToRow(player: Player, userId: string) {
  return {
    id: player.id,
    user_id: userId,
    name: formatPlayerName(player.name),
    roll_no: player.rollNo,
    branch: player.branch,
    class: player.class,
    year: player.year ?? null,
    division: player.division ?? null,
    estimated_elo: player.estimatedElo ?? null,
    official_elo: player.officialElo ?? null,
    fide_rating: player.fideRating ?? null,
    games_played: player.gamesPlayed,
    wins: player.wins,
    losses: player.losses,
    draws: player.draws,
    is_rated: player.isRated ?? false,
    program: player.program ?? null,
    enrollment_no: player.enrollmentNo ?? null,
    mobile_no: player.mobileNo ?? null,
    email: player.email ?? null,
    created_at: player.createdAt,
  };
}

function rowToTournament(row: any): Tournament {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    format: row.format,
    status: row.status,
    rounds: row.rounds,
    currentRound: row.current_round,
    players: row.players ?? [],
    byes: row.byes ?? [],
    timeControls: row.time_controls ?? {},
    byeHistory: row.bye_history ?? {},
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    createdAt: row.created_at,
  };
}

function tournamentToRow(t: Tournament, userId: string) {
  return {
    id: t.id,
    user_id: userId,
    name: t.name,
    description: t.description ?? null,
    format: t.format,
    status: t.status,
    rounds: t.rounds,
    current_round: t.currentRound,
    players: t.players,
    byes: t.byes,
    time_controls: t.timeControls,
    bye_history: t.byeHistory,
    start_date: t.startDate ?? null,
    end_date: t.endDate ?? null,
    created_at: t.createdAt,
  };
}

function rowToPairing(row: any): Pairing {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    roundNumber: row.round_number,
    player1Id: row.player1_id,
    player2Id: row.player2_id ?? undefined,
    result: row.result ?? undefined,
    isBye: row.is_bye,
    createdAt: row.created_at,
  };
}

function pairingToRow(p: Pairing, userId: string) {
  return {
    id: p.id,
    user_id: userId,
    tournament_id: p.tournamentId,
    round_number: p.roundNumber,
    player1_id: p.player1Id,
    player2_id: p.player2Id ?? null,
    result: p.result ?? null,
    is_bye: p.isBye,
    created_at: p.createdAt,
  };
}

function rowToStanding(row: any): Standing {
  return {
    playerId: row.player_id,
    tournamentId: row.tournament_id,
    score: Number(row.score),
    buchholz: Number(row.buchholz),
    rating: row.rating,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    gamesPlayed: row.games_played,
  };
}

function standingToRow(s: Standing, userId: string) {
  return {
    player_id: s.playerId,
    tournament_id: s.tournamentId,
    user_id: userId,
    score: s.score,
    buchholz: s.buchholz,
    rating: s.rating,
    wins: s.wins,
    losses: s.losses,
    draws: s.draws,
    games_played: s.gamesPlayed,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export const useChessData = () => {
  const { user } = useAuth();

  const [players, setPlayers] = useState<Player[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // ── Initial load from Supabase ────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setPlayers([]); setTournaments([]); setPairings([]); setStandings([]);
      setIsLoaded(false);
      return;
    }

    const loadAll = async () => {
      setIsLoaded(false);
      try {
        const [pRes, tRes, paRes, stRes] = await Promise.all([
          supabase.from("players").select("*").order("created_at"),
          supabase.from("tournaments").select("*").order("created_at"),
          supabase.from("pairings").select("*").order("created_at"),
          supabase.from("standings").select("*"),
        ]);

        const rawPlayers = pRes.data ?? [];
        setPlayers(rawPlayers.map(rowToPlayer));
        setTournaments((tRes.data ?? []).map(rowToTournament));
        setPairings((paRes.data ?? []).map(rowToPairing));
        setStandings((stRes.data ?? []).map(rowToStanding));

        // Auto-migrate existing players in Supabase whose names are unformatted (e.g. ALL CAPS or lowercase)
        const unformatted = rawPlayers.filter((r: any) => {
          const proper = formatPlayerName(r.name);
          return proper && proper !== r.name;
        });

        if (unformatted.length > 0) {
          Promise.all(
            unformatted.map((r: any) =>
              supabase
                .from("players")
                .update({ name: formatPlayerName(r.name) })
                .eq("id", r.id)
            )
          ).then(() => {
            console.log(`Auto-formatted ${unformatted.length} player name(s) in Supabase.`);
          }).catch((err) => {
            console.error("Auto-migrating player names error:", err);
          });
        }

        // Auto-fix any auto-seeded players who have branch = 'BTech' by clearing branch
        const btechPlayers = rawPlayers.filter((r: any) => r.branch === "BTech");
        if (btechPlayers.length > 0) {
          Promise.all(
            btechPlayers.map((r: any) =>
              supabase.from("players").update({ branch: "" }).eq("id", r.id)
            )
          ).then(() => {
            console.log(`Auto-cleaned branch for ${btechPlayers.length} player(s) in Supabase.`);
          }).catch((err) => {
            console.error("Auto-cleaning branch error:", err);
          });
        }

      } catch (err) {
        console.error("Failed to load data from Supabase:", err);
      } finally {
        setIsLoaded(true);
      }
    };

    loadAll();
  }, [user?.id]);

  // ── Player operations ─────────────────────────────────────────────────────
  const addPlayer = useCallback(async (player: Player) => {
    if (!user) return;
    const cleanPlayer = { ...player, name: formatPlayerName(player.name) };
    setPlayers(prev => [...prev, cleanPlayer]); // optimistic
    const { error } = await supabase.from("players").insert(playerToRow(cleanPlayer, user.id));
    if (error) {
      console.error("addPlayer:", error);
      setPlayers(prev => prev.filter(p => p.id !== cleanPlayer.id));
    }
  }, [user]);

  // Bulk insert many players in one Supabase call (used by CSV/Excel import)
  const bulkAddPlayers = useCallback(async (newPlayers: Player[]) => {
    if (!user || newPlayers.length === 0) return;
    const cleanPlayers = newPlayers.map(p => ({ ...p, name: formatPlayerName(p.name) }));
    setPlayers(prev => [...prev, ...cleanPlayers]); // optimistic
    const rows = cleanPlayers.map(p => playerToRow(p, user.id));
    const { error } = await supabase.from("players").insert(rows);
    if (error) {
      console.error("bulkAddPlayers:", error);
      const ids = new Set(cleanPlayers.map(p => p.id));
      setPlayers(prev => prev.filter(p => !ids.has(p.id)));
      throw error;
    }
  }, [user]);

  const updatePlayer = useCallback(async (player: Player) => {
    if (!user) return;
    const cleanPlayer = { ...player, name: formatPlayerName(player.name) };
    setPlayers(prev => prev.map(p => p.id === cleanPlayer.id ? cleanPlayer : p));
    const { error } = await supabase.from("players").update(playerToRow(cleanPlayer, user.id)).eq("id", cleanPlayer.id);
    if (error) console.error("updatePlayer:", error);
  }, [user]);

  const deletePlayer = useCallback(async (id: string) => {
    if (!user) return;
    setPlayers(prev => prev.filter(p => p.id !== id));
    const { error } = await supabase.from("players").delete().eq("id", id);
    if (error) console.error("deletePlayer:", error);
  }, [user]);

  // ── Tournament operations ─────────────────────────────────────────────────
  const addTournament = useCallback(async (tournament: Tournament) => {
    if (!user) return;
    setTournaments(prev => [...prev, tournament]);
    const { error } = await supabase.from("tournaments").insert(tournamentToRow(tournament, user.id));
    if (error) {
      console.error("addTournament:", error);
      setTournaments(prev => prev.filter(t => t.id !== tournament.id));
    }
  }, [user]);

  const updateTournament = useCallback(async (tournament: Tournament) => {
    if (!user) return;
    setTournaments(prev => prev.map(t => t.id === tournament.id ? tournament : t));
    const { error } = await supabase.from("tournaments").update(tournamentToRow(tournament, user.id)).eq("id", tournament.id);
    if (error) console.error("updateTournament:", error);
  }, [user]);

  const deleteTournament = useCallback(async (id: string) => {
    if (!user) return;
    setTournaments(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from("tournaments").delete().eq("id", id);
    if (error) console.error("deleteTournament:", error);
  }, [user]);

  // ── Pairing operations ────────────────────────────────────────────────────
  const addPairing = useCallback(async (pairing: Pairing) => {
    if (!user) return;
    setPairings(prev => [...prev, pairing]);
    const { error } = await supabase.from("pairings").insert(pairingToRow(pairing, user.id));
    if (error) {
      console.error("addPairing:", error);
      setPairings(prev => prev.filter(p => p.id !== pairing.id));
    }
  }, [user]);

  const updatePairing = useCallback(async (pairing: Pairing) => {
    if (!user) return;
    setPairings(prev => prev.map(p => p.id === pairing.id ? pairing : p));
    const { error } = await supabase.from("pairings").update(pairingToRow(pairing, user.id)).eq("id", pairing.id);
    if (error) console.error("updatePairing:", error);
  }, [user]);

  const deletePairing = useCallback(async (id: string) => {
    if (!user) return;
    setPairings(prev => prev.filter(p => p.id !== id));
    const { error } = await supabase.from("pairings").delete().eq("id", id);
    if (error) console.error("deletePairing:", error);
  }, [user]);

  const deletePairingsByRound = useCallback(async (tournamentId: string, roundNumber: number) => {
    if (!user) return;
    setPairings(prev => prev.filter(p => !(p.tournamentId === tournamentId && p.roundNumber === roundNumber)));
    const { error } = await supabase.from("pairings")
      .delete()
      .eq("tournament_id", tournamentId)
      .eq("round_number", roundNumber);
    if (error) console.error("deletePairingsByRound:", error);
  }, [user]);

  // ── Standing operations ───────────────────────────────────────────────────
  const addStanding = useCallback(async (standing: Standing) => {
    if (!user) return;
    setStandings(prev => {
      const exists = prev.some(s => s.playerId === standing.playerId && s.tournamentId === standing.tournamentId);
      return exists ? prev : [...prev, standing];
    });
    const { error } = await supabase.from("standings")
      .upsert(standingToRow(standing, user.id), { onConflict: "player_id,tournament_id" });
    if (error) console.error("addStanding:", error);
  }, [user]);

  const updateStanding = useCallback(async (standing: Standing) => {
    if (!user) return;
    setStandings(prev =>
      prev.map(s => s.playerId === standing.playerId && s.tournamentId === standing.tournamentId ? standing : s)
    );
    const { error } = await supabase.from("standings")
      .upsert(standingToRow(standing, user.id), { onConflict: "player_id,tournament_id" });
    if (error) console.error("updateStanding:", error);
  }, [user]);

  // ── Derived helpers ───────────────────────────────────────────────────────
  const getTournamentPlayers = useCallback((tournamentId: string) => {
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (!tournament) return [];
    return players.filter(p => tournament.players.includes(p.id));
  }, [tournaments, players]);

  const getTournamentStandings = useCallback((tournamentId: string) => {
    return standings.filter(s => s.tournamentId === tournamentId).sort((a, b) => b.score - a.score);
  }, [standings]);

  return {
    players, tournaments, pairings, standings, isLoaded,
    addPlayer, updatePlayer, deletePlayer, bulkAddPlayers,
    addTournament, updateTournament, deleteTournament,
    addPairing, updatePairing, deletePairing, deletePairingsByRound,
    addStanding, updateStanding,
    getTournamentPlayers, getTournamentStandings,
  };
};

const NATIONAL_SPORTS_DAY_PARTICIPANTS = [
  { name: "Prathamesh Shinkar", year: "", program: "B.Tech", branch: "" },
  { name: "Aditya Jagatap", year: "SY", program: "B.Tech", branch: "" },
  { name: "Adwit Ghuge", year: "SY", program: "B.Tech", branch: "" },
  { name: "Arman Attar", year: "SY", program: "B.Tech", branch: "" },
  { name: "Abhishek Biradar", year: "SY", program: "B.Tech", branch: "" },
  { name: "Chirag Parmar", year: "SY", program: "B.Tech", branch: "" },
  { name: "Rushikesh Ingle", year: "TY", program: "B.Tech", branch: "" },
  { name: "Omkar Hirwe", year: "TY", program: "B.Tech", branch: "" },
  { name: "Pruthviraj Kaemale", year: "TY", program: "B.Tech", branch: "" },
  { name: "Krishna Nagwanshi", year: "TY", program: "B.Tech", branch: "" },
  { name: "Pranay Barva", year: "TY", program: "B.Tech", branch: "" },
  { name: "Gayatri Salave", year: "TY", program: "B.Tech", branch: "" },
  { name: "Harsharaj Singh", year: "TY", program: "B.Tech", branch: "" },
  { name: "Chirantan Vibhute", year: "TY", program: "B.Tech", branch: "" },
  { name: "Yogesh Kankariya", year: "TY", program: "B.Tech", branch: "" },
  { name: "Sarthak Ardhapure", year: "TY", program: "B.Tech", branch: "" },
  { name: "Aamir Aland", year: "TY", program: "B.Tech", branch: "" },
  { name: "Ashish Choudhari", year: "TY", program: "B.Tech", branch: "" },
  { name: "Sainath Kurve", year: "TY", program: "B.Tech", branch: "" },
  { name: "Sainath Patil", year: "TY", program: "B.Tech", branch: "" },
  { name: "Mohammd Tahashaikh", year: "TY", program: "B.Tech", branch: "" },
  { name: "Kaustubh Rahate", year: "TY", program: "B.Tech", branch: "" },
  { name: "Vishwajit Salunke", year: "TY", program: "B.Tech", branch: "" },
  { name: "Shahid Jamadar", year: "TY", program: "B.Tech", branch: "" },
  { name: "Atharv Gupta", year: "TY", program: "B.Tech", branch: "" },
  { name: "Mayur Shirsat", year: "TY", program: "B.Tech", branch: "" },
  { name: "Tanmay Kadam", year: "TY", program: "B.Tech", branch: "" },
  { name: "Darshan Bamnkar", year: "TY", program: "B.Tech", branch: "" },
  { name: "Krish Katre", year: "TY", program: "B.Tech", branch: "" },
  { name: "Hruday Mankar", year: "TY", program: "B.Tech", branch: "" },
  { name: "Swarup Nalawade", year: "TY", program: "B.Tech", branch: "" },
  { name: "Hariom Tiwari", year: "TY", program: "B.Tech", branch: "" },
  { name: "Mohit Jadhav", year: "TY", program: "B.Tech", branch: "" },
  { name: "Aashish Choudhary", year: "TY", program: "B.Tech", branch: "" },
  { name: "Aditya Pal", year: "TY", program: "B.Tech", branch: "" },
  { name: "Omkar Gujjewar", year: "TY", program: "B.Tech", branch: "" },
  { name: "Kishor Jaiswal", year: "TY", program: "B.Tech", branch: "" }
];
