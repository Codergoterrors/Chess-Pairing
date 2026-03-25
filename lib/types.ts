// Player branch types
export type Branch = "CSE AIML" | "CSE AIDS" | "CSE AI" | "CSE CySec" | "IT" | "CE" | "ENTC" | "Civil" | "Mechanical";

// Player data model
export interface Player {
  id: string;
  name: string;
  rollNo: string;
  branch: Branch | string;
  class?: string;
  year?: string;
  division?: string;
  estimatedElo?: number;
  officialElo?: number | null;
  fideRating?: number | null;
  gamesPlayed?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  isRated?: boolean;
  createdAt: number;
}

// Time control types
export type TimeControl = "Bullet" | "Blitz" | "Rapid" | "Classical" | "Custom";

export interface TimeControlConfig {
  type: TimeControl;
  minutesPerSide: number;
  increment?: number;
}

// Tournament data model
export interface Tournament {
  id: string;
  name: string;
  description?: string;
  format: "Swiss" | "RoundRobin" | "Knockout";
  status: "planning" | "in-progress" | "completed" | "upcoming";
  rounds: number;
  currentRound: number;
  players: string[];
  byes: string[];
  timeControls: { [roundNumber: number]: TimeControlConfig };
  byeHistory?: { [playerId: string]: number[] };
  createdAt: number;
  startDate?: number;
  endDate?: number;
}

// Pairing data model
export interface Pairing {
  id: string;
  tournamentId: string;
  roundNumber: number;
  player1Id: string;
  player2Id?: string;
  result?: "win1" | "win2" | "draw";
  isBye: boolean;
  createdAt: number;
}

// Standing data model
export interface Standing {
  playerId: string;
  tournamentId: string;
  score: number;
  buchholz: number;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
}

// Game result
export interface GameResult {
  pairingId: string;
  result: "win1" | "win2" | "draw";
  timestamp: number;
}

export const BRANCHES: Branch[] = [
  "CSE AIML", "CSE AIDS", "CSE AI", "CSE CySec",
  "IT", "CE", "ENTC", "Civil", "Mechanical",
];

export const ELO_CATEGORIES = {
  beginner: { min: 600, max: 900 },
  intermediate: { min: 900, max: 1400 },
  advanced: { min: 1400, max: 1800 },
  expert: { min: 1800, max: 3000 },
};

export const TIME_CONTROL_PRESETS: { [key in TimeControl]: Omit<TimeControlConfig, 'type'> } = {
  Bullet: { minutesPerSide: 1, increment: 0 },
  Blitz: { minutesPerSide: 3, increment: 2 },
  Rapid: { minutesPerSide: 10, increment: 0 },
  Classical: { minutesPerSide: 30, increment: 0 },
  Custom: { minutesPerSide: 5, increment: 0 },
};

export function calculateRounds(playerCount: number, format: string): number {
  if (format === "Swiss") {
    return Math.ceil(Math.log2(Math.max(playerCount, 2)));
  } else if (format === "RoundRobin") {
    return Math.max(playerCount - 1, 1);
  } else if (format === "Knockout") {
    return Math.ceil(Math.log2(playerCount));
  }
  return 1;
}