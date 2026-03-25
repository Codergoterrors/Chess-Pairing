"use client";

import { Player, Tournament, Pairing, Standing, GameResult } from "./types";

const STORAGE_KEYS = {
  PLAYERS: "chess_players",
  TOURNAMENTS: "chess_tournaments",
  PAIRINGS: "chess_pairings",
  STANDINGS: "chess_standings",
  GAME_RESULTS: "chess_game_results",
};

// Player storage
export const playerStorage = {
  getAll: (): Player[] => {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(STORAGE_KEYS.PLAYERS);
    return data ? JSON.parse(data) : [];
  },

  get: (id: string): Player | null => {
    const players = playerStorage.getAll();
    return players.find((p) => p.id === id) || null;
  },

  add: (player: Player): void => {
    const players = playerStorage.getAll();
    players.push(player);
    localStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(players));
  },

  update: (player: Player): void => {
    const players = playerStorage.getAll();
    const index = players.findIndex((p) => p.id === player.id);
    if (index !== -1) {
      players[index] = player;
      localStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(players));
    }
  },

  delete: (id: string): void => {
    const players = playerStorage.getAll();
    const filtered = players.filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(filtered));
  },

  deleteAll: (): void => {
    localStorage.removeItem(STORAGE_KEYS.PLAYERS);
  },
};

// Tournament storage
export const tournamentStorage = {
  getAll: (): Tournament[] => {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(STORAGE_KEYS.TOURNAMENTS);
    if (!data) return [];
    
    try {
      const tournaments = JSON.parse(data);
      // Migrate old tournament data to include new fields
      return tournaments.map((t: any) => ({
        ...t,
        timeControls: t.timeControls || {},
        byeHistory: t.byeHistory || {},
      }));
    } catch (error) {
      console.error("[v0] Error parsing tournaments from storage", error);
      return [];
    }
  },

  get: (id: string): Tournament | null => {
    const tournaments = tournamentStorage.getAll();
    return tournaments.find((t) => t.id === id) || null;
  },

  add: (tournament: Tournament): void => {
    const tournaments = tournamentStorage.getAll();
    tournaments.push({
      ...tournament,
      timeControls: tournament.timeControls || {},
      byeHistory: tournament.byeHistory || {},
    });
    localStorage.setItem(STORAGE_KEYS.TOURNAMENTS, JSON.stringify(tournaments));
  },

  update: (tournament: Tournament): void => {
    const tournaments = tournamentStorage.getAll();
    const index = tournaments.findIndex((t) => t.id === tournament.id);
    if (index !== -1) {
      tournaments[index] = {
        ...tournament,
        timeControls: tournament.timeControls || {},
        byeHistory: tournament.byeHistory || {},
      };
      localStorage.setItem(STORAGE_KEYS.TOURNAMENTS, JSON.stringify(tournaments));
    }
  },

  delete: (id: string): void => {
    const tournaments = tournamentStorage.getAll();
    const filtered = tournaments.filter((t) => t.id !== id);
    localStorage.setItem(STORAGE_KEYS.TOURNAMENTS, JSON.stringify(filtered));
  },

  deleteAll: (): void => {
    localStorage.removeItem(STORAGE_KEYS.TOURNAMENTS);
  },
};

// Pairing storage
export const pairingStorage = {
  getAll: (): Pairing[] => {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(STORAGE_KEYS.PAIRINGS);
    return data ? JSON.parse(data) : [];
  },

  getByTournament: (tournamentId: string): Pairing[] => {
    return pairingStorage.getAll().filter((p) => p.tournamentId === tournamentId);
  },

  getByRound: (tournamentId: string, roundNumber: number): Pairing[] => {
    return pairingStorage.getAll().filter((p) => p.tournamentId === tournamentId && p.roundNumber === roundNumber);
  },

  get: (id: string): Pairing | null => {
    return pairingStorage.getAll().find((p) => p.id === id) || null;
  },

  add: (pairing: Pairing): void => {
    const pairings = pairingStorage.getAll();
    pairings.push(pairing);
    localStorage.setItem(STORAGE_KEYS.PAIRINGS, JSON.stringify(pairings));
  },

  update: (pairing: Pairing): void => {
    const pairings = pairingStorage.getAll();
    const index = pairings.findIndex((p) => p.id === pairing.id);
    if (index !== -1) {
      pairings[index] = pairing;
      localStorage.setItem(STORAGE_KEYS.PAIRINGS, JSON.stringify(pairings));
    }
  },

  delete: (id: string): void => {
    const pairings = pairingStorage.getAll();
    const filtered = pairings.filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PAIRINGS, JSON.stringify(filtered));
  },

  deleteAll: (): void => {
    localStorage.removeItem(STORAGE_KEYS.PAIRINGS);
  },
};

// Standing storage
export const standingStorage = {
  getAll: (): Standing[] => {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(STORAGE_KEYS.STANDINGS);
    return data ? JSON.parse(data) : [];
  },

  getByTournament: (tournamentId: string): Standing[] => {
    return standingStorage.getAll().filter((s) => s.tournamentId === tournamentId);
  },

  add: (standing: Standing): void => {
    const standings = standingStorage.getAll();
    standings.push(standing);
    localStorage.setItem(STORAGE_KEYS.STANDINGS, JSON.stringify(standings));
  },

  update: (standing: Standing): void => {
    const standings = standingStorage.getAll();
    const index = standings.findIndex((s) => s.playerId === standing.playerId && s.tournamentId === standing.tournamentId);
    if (index !== -1) {
      standings[index] = standing;
      localStorage.setItem(STORAGE_KEYS.STANDINGS, JSON.stringify(standings));
    }
  },

  delete: (playerId: string, tournamentId: string): void => {
    const standings = standingStorage.getAll();
    const filtered = standings.filter((s) => !(s.playerId === playerId && s.tournamentId === tournamentId));
    localStorage.setItem(STORAGE_KEYS.STANDINGS, JSON.stringify(filtered));
  },

  deleteAll: (): void => {
    localStorage.removeItem(STORAGE_KEYS.STANDINGS);
  },
};

// Game results storage
export const resultStorage = {
  getAll: (): GameResult[] => {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(STORAGE_KEYS.GAME_RESULTS);
    return data ? JSON.parse(data) : [];
  },

  add: (result: GameResult): void => {
    const results = resultStorage.getAll();
    results.push(result);
    localStorage.setItem(STORAGE_KEYS.GAME_RESULTS, JSON.stringify(results));
  },

  deleteAll: (): void => {
    localStorage.removeItem(STORAGE_KEYS.GAME_RESULTS);
  },
};
