"use client";

import { useState, useCallback, useEffect } from "react";
import { Player, Tournament, Pairing, Standing } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

// ── DB row → app type mappers ────────────────────────────────────────────────
function rowToPlayer(row: any): Player {
  return {
    id: row.id,
    name: row.name,
    rollNo: row.roll_no,
    branch: row.branch,
    class: row.class,
    estimatedElo: row.estimated_elo ?? undefined,
    officialElo: row.official_elo ?? undefined,
    fideRating: row.fide_rating ?? undefined,
    gamesPlayed: row.games_played,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    isRated: row.is_rated,
    createdAt: row.created_at,
  };
}

function playerToRow(player: Player, userId: string) {
  return {
    id: player.id,
    user_id: userId,
    name: player.name,
    roll_no: player.rollNo,
    branch: player.branch,
    class: player.class,
    estimated_elo: player.estimatedElo ?? null,
    official_elo: player.officialElo ?? null,
    fide_rating: player.fideRating ?? null,
    games_played: player.gamesPlayed,
    wins: player.wins,
    losses: player.losses,
    draws: player.draws,
    is_rated: player.isRated ?? false,
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
          supabase.from("players").select("*").eq("user_id", user.id).order("created_at"),
          supabase.from("tournaments").select("*").eq("user_id", user.id).order("created_at"),
          supabase.from("pairings").select("*").eq("user_id", user.id).order("created_at"),
          supabase.from("standings").select("*").eq("user_id", user.id),
        ]);

        setPlayers((pRes.data ?? []).map(rowToPlayer));
        setTournaments((tRes.data ?? []).map(rowToTournament));
        setPairings((paRes.data ?? []).map(rowToPairing));
        setStandings((stRes.data ?? []).map(rowToStanding));
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
    setPlayers(prev => [...prev, player]); // optimistic
    const { error } = await supabase.from("players").insert(playerToRow(player, user.id));
    if (error) {
      console.error("addPlayer:", error);
      setPlayers(prev => prev.filter(p => p.id !== player.id));
    }
  }, [user]);

  const updatePlayer = useCallback(async (player: Player) => {
    if (!user) return;
    setPlayers(prev => prev.map(p => p.id === player.id ? player : p));
    const { error } = await supabase.from("players").update(playerToRow(player, user.id)).eq("id", player.id);
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
    addPlayer, updatePlayer, deletePlayer,
    addTournament, updateTournament, deleteTournament,
    addPairing, updatePairing, deletePairing, deletePairingsByRound,
    addStanding, updateStanding,
    getTournamentPlayers, getTournamentStandings,
  };
};
