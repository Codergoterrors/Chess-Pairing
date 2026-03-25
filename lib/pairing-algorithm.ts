import { Player, Pairing, Standing } from "./types";
import { generateId, havePlayedBefore, calculateCurrentRating, isPlayerRated, getPlayerByeHistory, findByeRotationPlayer } from "./utils-chess";

interface PairingInput {
  players: Player[];
  standings: Standing[];
  pairings: Pairing[];
  round: number;
  byes: string[];
}

interface PairingResult {
  pairings: Pairing[];
  byes: string[];
}

/**
 * Pair an array of players greedily, avoiding rematches.
 * Returns pairings and any leftover unpaired players.
 */
function pairGroup(
  group: Player[],
  existingPairings: Pairing[],
  round: number
): { pairings: Pairing[]; leftover: Player[] } {
  const newPairings: Pairing[] = [];
  const paired = new Set<string>();

  for (let i = 0; i < group.length; i++) {
    const p1 = group[i];
    if (paired.has(p1.id)) continue;

    for (let j = i + 1; j < group.length; j++) {
      const p2 = group[j];
      if (paired.has(p2.id)) continue;
      if (havePlayedBefore(p1.id, p2.id, existingPairings)) continue;

      newPairings.push({
        id: generateId(),
        tournamentId: "",
        roundNumber: round,
        player1Id: p1.id,
        player2Id: p2.id,
        isBye: false,
        createdAt: Date.now(),
      });
      paired.add(p1.id);
      paired.add(p2.id);
      break;
    }
  }

  const leftover = group.filter((p) => !paired.has(p.id));
  return { pairings: newPairings, leftover };
}

/**
 * Swiss / Knockout Pairing Algorithm
 *
 * KEY FIX: BYE is assigned FIRST (globally, before any score grouping).
 * This guarantees the same player never gets BYE twice as long as any
 * other player hasn't had one yet.
 *
 * Fairness rules:
 * 1. If odd number of players → pick BYE candidate FIRST:
 *    - Prefer players who have NEVER had a BYE (lowest rated among them)
 *    - Remove them from the pool before pairing begins
 * 2. Pair remaining (even) players by score group
 * 3. Within each score group: rated vs rated (closest rating), unrated vs unrated
 * 4. Cross-group leftovers paired together (rated preference, mixed as last resort)
 */
export function generateSwissPairings(input: PairingInput): PairingResult {
  const { players, standings, pairings: existingPairings, round } = input;

  if (players.length < 2) {
    return { pairings: [], byes: [] };
  }

  const standingsMap = new Map(standings.map((s) => [s.playerId, s]));
  const newPairings: Pairing[] = [];
  const newByes = new Set<string>();

  // ── Step 1: Assign BYE FIRST if odd number of players ────────────────────
  let activePlayers = [...players];

  if (activePlayers.length % 2 !== 0) {
    const byePlayerId = findByeRotationPlayer(
      activePlayers.map((p) => p.id),
      standingsMap,
      existingPairings,
      round
    );

    if (byePlayerId) {
      newByes.add(byePlayerId);
      newPairings.push({
        id: generateId(),
        tournamentId: "",
        roundNumber: round,
        player1Id: byePlayerId,
        isBye: true,
        createdAt: Date.now(),
      });
      // Remove BYE player from the pool so they don't get paired
      activePlayers = activePlayers.filter((p) => p.id !== byePlayerId);
    }
  }

  // ── Step 2: Group remaining (even) players by score ──────────────────────
  const scoreGroups = new Map<number, Player[]>();
  activePlayers.forEach((player) => {
    const score = standingsMap.get(player.id)?.score ?? 0;
    if (!scoreGroups.has(score)) scoreGroups.set(score, []);
    scoreGroups.get(score)!.push(player);
  });

  const sortedScores = Array.from(scoreGroups.keys()).sort((a, b) => b - a);
  let globalLeftover: Player[] = [];

  // ── Step 3: Pair within each score group (rated vs rated, unrated vs unrated)
  for (const score of sortedScores) {
    const group = scoreGroups.get(score)!;

    const rated = group
      .filter((p) => isPlayerRated(p))
      .sort((a, b) => calculateCurrentRating(b) - calculateCurrentRating(a));

    const unrated = group.filter((p) => !isPlayerRated(p));

    const ratedResult = pairGroup(rated, existingPairings, round);
    ratedResult.pairings.forEach((p) => newPairings.push(p));

    const unratedResult = pairGroup(unrated, existingPairings, round);
    unratedResult.pairings.forEach((p) => newPairings.push(p));

    globalLeftover.push(...ratedResult.leftover, ...unratedResult.leftover);
  }

  // ── Step 4: Pair cross-group leftovers ───────────────────────────────────
  // Since we removed BYE player first, globalLeftover should always be even.
  // If somehow odd (shouldn't happen), the last player gets no pairing.
  if (globalLeftover.length > 0) {
    const leftRated = globalLeftover.filter((p) => isPlayerRated(p));
    const leftUnrated = globalLeftover.filter((p) => !isPlayerRated(p));

    const lr = pairGroup(leftRated, existingPairings, round);
    lr.pairings.forEach((p) => newPairings.push(p));

    const lu = pairGroup(leftUnrated, existingPairings, round);
    lu.pairings.forEach((p) => newPairings.push(p));

    // Last resort: mixed rated + unrated
    const remaining = [...lr.leftover, ...lu.leftover];
    if (remaining.length >= 2) {
      const rm = pairGroup(remaining, existingPairings, round);
      rm.pairings.forEach((p) => newPairings.push(p));
    }
  }

  return {
    pairings: newPairings,
    byes: Array.from(newByes),
  };
}

/**
 * Update standings after a round result
 */
export function updateStandingsAfterRound(
  pairings: Pairing[],
  standings: Map<string, Standing>,
  players: Map<string, Player>
): Map<string, Standing> {
  const updated = new Map(standings);

  pairings.forEach((pairing) => {
    if (!pairing.result && !pairing.isBye) return;

    const player1 = players.get(pairing.player1Id);
    if (!player1) return;

    let player1Standing = updated.get(pairing.player1Id);
    if (!player1Standing) {
      player1Standing = {
        playerId: pairing.player1Id,
        score: 0,
        buchholz: 0,
        rating: calculateCurrentRating(player1),
        wins: 0,
        losses: 0,
        draws: 0,
        gamesPlayed: 0,
      };
    }

    if (pairing.isBye) {
      player1Standing.score += 1;
      player1Standing.wins += 1;
      player1Standing.gamesPlayed += 1;
    } else if (pairing.player2Id) {
      player1Standing.gamesPlayed += 1;

      if (pairing.result === "win1") {
        player1Standing.score += 1;
        player1Standing.wins += 1;
      } else if (pairing.result === "win2") {
        player1Standing.losses += 1;
      } else if (pairing.result === "draw") {
        player1Standing.score += 0.5;
        player1Standing.draws += 1;
      }

      const player2 = players.get(pairing.player2Id);
      if (player2) {
        let player2Standing = updated.get(pairing.player2Id);
        if (!player2Standing) {
          player2Standing = {
            playerId: pairing.player2Id,
            score: 0,
            buchholz: 0,
            rating: calculateCurrentRating(player2),
            wins: 0,
            losses: 0,
            draws: 0,
            gamesPlayed: 0,
          };
        }

        player2Standing.gamesPlayed += 1;

        if (pairing.result === "win2") {
          player2Standing.score += 1;
          player2Standing.wins += 1;
        } else if (pairing.result === "win1") {
          player2Standing.losses += 1;
        } else if (pairing.result === "draw") {
          player2Standing.score += 0.5;
          player2Standing.draws += 1;
        }

        updated.set(pairing.player2Id, player2Standing);
      }
    }

    updated.set(pairing.player1Id, player1Standing);
  });

  // Recalculate Buchholz scores
  updated.forEach((standing) => {
    let buchholz = 0;
    pairings.forEach((pairing) => {
      if (pairing.isBye || !pairing.result) return;

      const isPlayer1 = pairing.player1Id === standing.playerId;
      const isPlayer2 = pairing.player2Id === standing.playerId;

      if (isPlayer1 && pairing.player2Id) {
        const opponentStanding = updated.get(pairing.player2Id);
        if (opponentStanding) buchholz += opponentStanding.score;
      } else if (isPlayer2 && pairing.player1Id) {
        const opponentStanding = updated.get(pairing.player1Id);
        if (opponentStanding) buchholz += opponentStanding.score;
      }
    });
    standing.buchholz = buchholz;
  });

  return updated;
}
