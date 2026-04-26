// Re-export types from server
// Note: In production, these would come from a shared types package
export interface Domino {
  left: number;
  right: number;
}

export interface Player {
  id: string;
  name: string;
  hand: Domino[];
  score: number;
  isActive: boolean;
}

export interface GameState {
  id: string;
  roomId: string;
  players: Player[];
  board: Domino[];
  boardLeft: number;
  boardRight: number;
  playerOrder: string[];
  currentPlayerIndex: number;
  bank: Domino[];
  status: 'waiting' | 'playing' | 'finished';
  winner?: string;
  gameReason?: 'NORMAL_WIN' | 'BLOCKED' | 'RESIGNATION' | 'CARROÇA';
  consecutivePasses: number;
  round: number;
}

export interface Room {
  id: string;
  name: string;
  players: Player[];
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'finished';
  gameId?: string;
  createdAt: number;
}
