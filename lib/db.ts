import { supabase } from "./supabase";
import { Player, Tournament, Pairing, Standing } from "./types";

// ── Type mappers ─────────────────────────────────────────────────────────────

function rowToPlayer(row: any): Player {
  return {
    id: row.id,
    name: row.name,
    rollNo: row.roll_no,
    branch: row.branch,
    year: row.year ?? "",
    division: row.division ?? "",
    isRated: row.is_rated,
    officialElo: row.official_elo,
    fideRating: row.fide_rating,
    estimatedElo: row.estimated_elo,
    createdAt: row.created_at,
  };
}

function playerToRow(player: Player, userId: string) {
  return {
    id: player.id,
    user_id: userId,
    name: player.name,
    roll_no: player.rollNo ?? "",
    branch: player.branch ?? "",
    year: player.year ?? "",
    division: player.division ?? "",
    is_rated: player.isRated ?? false,
    official_elo: player.officialElo ?? null,
    fide_rating: player.fideRating ?? null,
    estimated_elo: player.estimatedElo ?? null,
    created_at: player.createdAt ?? Date.now(),
  };
}

function rowToTournament(row: any): Tournament {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    format: row.format,
    status: row.status,
    rounds: row.rounds,
    currentRound: row.current_round,
    players: row.players ?? [],
    byes: row.byes ?? [],
    timeControls: row.time_controls ?? {},
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
  };
}

function tournamentToRow(t: Tournament, userId: string) {
  return {
    id: t.id,
    user_id: userId,
    name: t.name,
    description: t.description ?? "",
    format: t.format ?? "Swiss",
    status: t.status ?? "upcoming",
    rounds: t.rounds ?? 4,
    current_round: t.currentRound ?? 1,
    players: t.players ?? [],
    byes: t.byes ?? [],
    time_controls: t.timeControls ?? {},
    start_date: t.startDate ?? null,
    end_date: t.endDate ?? null,
    created_at: t.createdAt ?? Date.now(),
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
    is_bye: p.isBye ?? false,
    created_at: p.createdAt ?? Date.now(),
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
    user_id: userId,
    tournament_id: s.tournamentId,
    score: s.score,
    buchholz: s.buchholz,
    rating: s.rating ?? 0,
    wins: s.wins ?? 0,
    losses: s.losses ?? 0,
    draws: s.draws ?? 0,
    games_played: s.gamesPlayed ?? 0,
  };
}

// ── Players ──────────────────────────────────────────────────────────────────

export const playerDB = {
  async getAll(userId: string): Promise<Player[]> {
    const { data, error } = await supabase
      .from("players").select("*").eq("user_id", userId).order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToPlayer);
  },
  async add(player: Player, userId: string): Promise<void> {
    const { error } = await supabase.from("players").insert(playerToRow(player, userId));
    if (error) throw error;
  },
  async update(player: Player, userId: string): Promise<void> {
    const { error } = await supabase.from("players").update(playerToRow(player, userId)).eq("id", player.id).eq("user_id", userId);
    if (error) throw error;
  },
  async delete(id: string, userId: string): Promise<void> {
    const { error } = await supabase.from("players").delete().eq("id", id).eq("user_id", userId);
    if (error) throw error;
  },
};

// ── Tournaments ───────────────────────────────────────────────────────────────

export const tournamentDB = {
  async getAll(userId: string): Promise<Tournament[]> {
    const { data, error } = await supabase
      .from("tournaments").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToTournament);
  },
  async add(tournament: Tournament, userId: string): Promise<void> {
    const { error } = await supabase.from("tournaments").insert(tournamentToRow(tournament, userId));
    if (error) throw error;
  },
  async update(tournament: Tournament, userId: string): Promise<void> {
    const { error } = await supabase.from("tournaments").update(tournamentToRow(tournament, userId)).eq("id", tournament.id).eq("user_id", userId);
    if (error) throw error;
  },
  async delete(id: string, userId: string): Promise<void> {
    const { error } = await supabase.from("tournaments").delete().eq("id", id).eq("user_id", userId);
    if (error) throw error;
  },
};

// ── Pairings ──────────────────────────────────────────────────────────────────

export const pairingDB = {
  async getAll(userId: string): Promise<Pairing[]> {
    const { data, error } = await supabase
      .from("pairings").select("*").eq("user_id", userId).order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToPairing);
  },
  async add(pairing: Pairing, userId: string): Promise<void> {
    const { error } = await supabase.from("pairings").insert(pairingToRow(pairing, userId));
    if (error) throw error;
  },
  async update(pairing: Pairing, userId: string): Promise<void> {
    const { error } = await supabase.from("pairings").update(pairingToRow(pairing, userId)).eq("id", pairing.id).eq("user_id", userId);
    if (error) throw error;
  },
  async delete(id: string, userId: string): Promise<void> {
    const { error } = await supabase.from("pairings").delete().eq("id", id).eq("user_id", userId);
    if (error) throw error;
  },
};

// ── Standings ─────────────────────────────────────────────────────────────────

export const standingDB = {
  async getAll(userId: string): Promise<Standing[]> {
    const { data, error } = await supabase.from("standings").select("*").eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).map(rowToStanding);
  },
  async add(standing: Standing, userId: string): Promise<void> {
    const { error } = await supabase.from("standings").insert(standingToRow(standing, userId));
    if (error) throw error;
  },
  async update(standing: Standing, userId: string): Promise<void> {
    const { error } = await supabase.from("standings").update(standingToRow(standing, userId))
      .eq("player_id", standing.playerId).eq("tournament_id", standing.tournamentId).eq("user_id", userId);
    if (error) throw error;
  },
  async upsert(standing: Standing, userId: string): Promise<void> {
    const { error } = await supabase.from("standings").upsert(standingToRow(standing, userId), { onConflict: "player_id,tournament_id" });
    if (error) throw error;
  },
  async delete(playerId: string, tournamentId: string, userId: string): Promise<void> {
    const { error } = await supabase.from("standings").delete()
      .eq("player_id", playerId).eq("tournament_id", tournamentId).eq("user_id", userId);
    if (error) throw error;
  },
};