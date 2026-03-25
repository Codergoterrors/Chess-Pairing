import { v4 as uuidv4 } from "uuid";
import { Player, Pairing, Standing } from "./types";

// Generate unique ID
export const generateId = (): string => uuidv4();

// Calculate Elo rating change
export const calculateEloChange = (playerElo: number, opponentElo: number, result: "win" | "draw" | "loss", k = 32): number => {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  const actualScore = result === "win" ? 1 : result === "draw" ? 0.5 : 0;
  return Math.round(k * (actualScore - expectedScore));
};

// Check if a player is truly rated (has an actual rating, not just the default)
export const isPlayerRated = (player: Player): boolean => {
  return !!(player.officialElo || player.fideRating || player.estimatedElo);
};

// Calculate player's current rating based on games
export const calculateCurrentRating = (player: Player): number => {
  if (player.officialElo) return player.officialElo;
  if (player.fideRating) return player.fideRating;
  if (player.estimatedElo) return player.estimatedElo;
  return 0; // Unrated players get 0 so they can be distinguished from rated players
};

// Sort players into score groups (for Swiss system)
export const groupPlayersByScore = (standings: Standing[]): Map<number, Standing[]> => {
  const groups = new Map<number, Standing[]>();
  
  standings.forEach((standing) => {
    const score = standing.score;
    if (!groups.has(score)) {
      groups.set(score, []);
    }
    groups.get(score)!.push(standing);
  });

  // Sort each group by Elo (descending)
  groups.forEach((group) => {
    group.sort((a, b) => b.rating - a.rating);
  });

  return groups;
};

// Check if two players have already played each other
export const havePlayedBefore = (player1Id: string, player2Id: string, pairings: Pairing[]): boolean => {
  return pairings.some(
    (p) =>
      (p.player1Id === player1Id && p.player2Id === player2Id) ||
      (p.player1Id === player2Id && p.player2Id === player1Id)
  );
};

// Format time to readable string
export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString();
};

// Format player display name
export const formatPlayerName = (player: Player): string => {
  return `${player.name} (${player.rollNo}) - ${player.branch}`;
};

// Validate email (optional field)
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Calculate Buchholz score (sum of opponents' scores)
export const calculateBuchholz = (playerId: string, pairings: Pairing[], standings: Map<string, Standing>): number => {
  let buchholz = 0;
  
  pairings.forEach((pairing) => {
    if (pairing.isBye) return;
    
    const isPlayer1 = pairing.player1Id === playerId;
    const isPlayer2 = pairing.player2Id === playerId;
    
    if (isPlayer1 && pairing.player2Id) {
      const opponentStanding = standings.get(pairing.player2Id);
      if (opponentStanding) buchholz += opponentStanding.score;
    } else if (isPlayer2 && pairing.player1Id) {
      const opponentStanding = standings.get(pairing.player1Id);
      if (opponentStanding) buchholz += opponentStanding.score;
    }
  });
  
  return buchholz;
};

// Determine round status
export const getRoundStatus = (pairings: Pairing[], roundNumber: number): "pending" | "in-progress" | "completed" => {
  const roundPairings = pairings.filter((p) => p.roundNumber === roundNumber);
  
  if (roundPairings.length === 0) return "pending";
  
  const completedCount = roundPairings.filter((p) => p.result !== undefined).length;
  
  if (completedCount === 0) return "in-progress";
  if (completedCount === roundPairings.length) return "completed";
  
  return "in-progress";
};

// Get BYE history for a player
export const getPlayerByeHistory = (playerId: string, pairings: Pairing[]): number[] => {
  const byeRounds: number[] = [];
  
  pairings.forEach((pairing) => {
    if (pairing.isBye && pairing.player1Id === playerId) {
      byeRounds.push(pairing.roundNumber);
    }
  });
  
  return byeRounds.sort((a, b) => a - b);
};

// Check if player has had a bye in a specific round
export const hasPlayerHadByeInRound = (playerId: string, roundNumber: number, pairings: Pairing[]): boolean => {
  return pairings.some((p) => p.isBye && p.player1Id === playerId && p.roundNumber === roundNumber);
};

// Get players who haven't had a bye yet
export const getPlayersWithoutBye = (playerIds: string[], pairings: Pairing[]): string[] => {
  const byeHistory = new Map<string, number[]>();
  
  playerIds.forEach((id) => {
    byeHistory.set(id, getPlayerByeHistory(id, pairings));
  });
  
  return playerIds.filter((id) => byeHistory.get(id)!.length === 0);
};

// Rotate BYE — a player can only receive ONE BYE in the entire tournament.
// If all candidates already had a BYE, fall back to lowest-rated player.
export const findByeRotationPlayer = (
  playerIds: string[],
  standings: Map<string, Standing>,
  pairings: Pairing[],
  roundNumber: number
): string | null => {
  if (playerIds.length === 0) return null;

  // Strict first choice: players who have NEVER received a BYE
  const neverHadBye = playerIds.filter((id) => getPlayerByeHistory(id, pairings).length === 0);

  // If everyone has already had a BYE, fall back to all candidates
  // (unavoidable in long tournaments with odd players)
  const candidates = neverHadBye.length > 0 ? neverHadBye : playerIds;

  // Among candidates, pick the lowest-rated (least benefit from a free win)
  const sorted = [...candidates].sort((a, b) => {
    const aRating = standings.get(a)?.rating ?? 0;
    const bRating = standings.get(b)?.rating ?? 0;
    return aRating - bRating; // lowest rated gets BYE
  });

  return sorted[0] ?? null;
};
