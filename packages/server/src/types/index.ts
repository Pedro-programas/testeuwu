// ============================================
// Tipos Básicos do Dominó
// ============================================

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
  consecutivePasses: number;  // quantas vezes seguidas todos passaram
  round: number;
}

// ============================================
// Eventos Socket.IO / SQS
// ============================================

export interface SQSMessage {
  id: string;
  timestamp: number;
  action: string;
  playerId: string;
  gameId: string;
  payload: Record<string, any>;
}

export interface PlayCardPayload {
  gameId: string;
  playerId: string;
  card: Domino;
  position: 'left' | 'right';
}

export interface PassTurnPayload {
  gameId: string;
  playerId: string;
}

export interface DrawPiecePayload {
  gameId: string;
  playerId: string;
}

export interface JoinGamePayload {
  roomId: string;
  playerId: string;
  playerName: string;
}

export interface GameEventResponse {
  success: boolean;
  message: string;
  gameState?: GameState;
  error?: string;
}

// ============================================
// Room Management
// ============================================

export interface Room {
  id: string;
  name: string;
  players: Player[];
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'finished';
  gameId?: string;
  createdAt: number;
}

// ============================================
// SQS Service Interface
// ============================================

export interface ISQSService {
  sendMessage(message: SQSMessage): Promise<string>;
  receiveMessages(maxMessages: number): Promise<SQSMessage[]>;
  deleteMessage(receiptHandle: string): Promise<void>;
  purgeQueue(): Promise<void>;
}
