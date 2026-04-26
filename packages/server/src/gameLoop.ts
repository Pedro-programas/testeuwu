import type { Server as SocketIOServer } from 'socket.io';
import { GameService } from './services/gameService.js';
import type { ISQSService, SQSMessage, GameState, Room, Player } from './types/index.js';

// Map: roomId -> Set of active socketIds (para detectar W.O.)
export const roomActiveSockets: Map<string, Set<string>> = new Map();

// ============================================
// In-Memory Store (Game State)
// Shared within the same process as index.ts
// ============================================
export const games: Map<string, GameState> = new Map();
export const workerRooms: Map<string, Room> = new Map();

function saveGameState(gameState: GameState) {
  games.set(gameState.id, gameState);
}

export function getGameState(gameId: string): GameState | undefined {
  return games.get(gameId);
}

// ============================================
// Action Handlers
// ============================================

// Referência às rooms do index.ts (injetada via startGameLoop)
let _rooms: Map<string, Room>;

async function handleStartGame(message: SQSMessage, io: SocketIOServer) {
  const { roomId, players } = message.payload;

  if (!roomId || !players) {
    throw new Error('Payload inválido para start_game');
  }

  let gameState = GameService.initializeGame(roomId, players as Player[]);
  gameState = GameService.startGame(gameState);

  saveGameState(gameState);

  // Atualiza o gameId na room para o W.O. funcionar
  if (_rooms) {
    const room = _rooms.get(roomId);
    if (room) {
      room.gameId = gameState.id;
      _rooms.set(roomId, room);
    }
  }

  console.log(`[GAME-LOOP] 🎮 Jogo iniciado: ${gameState.id}`);
  console.log(`[GAME-LOOP] 👥 Jogadores: ${(players as Player[]).map((p: Player) => p.name).join(', ')}`);
  console.log(`[GAME-LOOP] 📋 Peças no banco: ${gameState.bank.length}`);

  broadcastGameState(io, gameState);
}

async function handlePlayCard(message: SQSMessage, io: SocketIOServer) {
  const { gameId, playerId, card, position } = message.payload;

  const gameState = getGameState(gameId);
  if (!gameState) throw new Error(`Jogo não encontrado: ${gameId}`);

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) throw new Error(`Jogador não encontrado: ${playerId}`);

  if (!GameService.isValidMove(gameState, playerId, card, position)) {
    throw new Error(`Movimento inválido: ${card.left}-${card.right} em ${position}`);
  }

  const updatedGame = GameService.playCard(gameState, { gameId, playerId, card, position });
  saveGameState(updatedGame);

  broadcastGameState(io, updatedGame);
}

async function handlePassTurn(message: SQSMessage, io: SocketIOServer) {
  const { gameId, playerId } = message.payload;

  const gameState = getGameState(gameId);
  if (!gameState) throw new Error(`Jogo não encontrado: ${gameId}`);

  const updatedGame = GameService.passTurn(gameState, { gameId, playerId });
  saveGameState(updatedGame);

  broadcastGameState(io, updatedGame);
}

async function handleDrawPiece(message: SQSMessage, io: SocketIOServer) {
  const { gameId, playerId } = message.payload;

  const gameState = getGameState(gameId);
  if (!gameState) throw new Error(`Jogo não encontrado: ${gameId}`);

  const updatedGame = GameService.drawPiece(gameState, { gameId, playerId });
  saveGameState(updatedGame);

  broadcastGameState(io, updatedGame);
}

// ============================================
// Helper: broadcast enriquecido com reason
// ============================================
function broadcastGameState(io: SocketIOServer, gameState: GameState) {
  const payload = {
    ...gameState,
    // Garante que o campo reason chega ao cliente
    gameReason: gameState.gameReason ?? null
  };

  if (gameState.status === 'finished') {
    const winner = gameState.players.find(p => p.id === gameState.winner);
    console.log(`[GAME-LOOP] 🏆 Partida encerrada! Vencedor: ${winner?.name ?? 'N/A'} | Motivo: ${gameState.gameReason}`);
    // Emite evento especial de fim de jogo
    io.to(gameState.roomId).emit('game_over', {
      winnerId: gameState.winner,
      winnerName: winner?.name,
      reason: gameState.gameReason
    });
  }

  io.to(gameState.roomId).emit('game_state_updated', payload);
}

// ============================================
// W.O.: verifica se só restou 1 jogador ativo
// Chamado pelo index.ts ao detectar disconnect
// ============================================
export function checkAndApplyWalkover(
  gameState: GameState,
  activePlayerIds: string[],
  io: SocketIOServer
): GameState | null {
  if (gameState.status !== 'playing') return null;
  if (activePlayerIds.length !== 1) return null;

  const survivorId = activePlayerIds[0];
  const survivor = gameState.players.find(p => p.id === survivorId);

  const updatedGame: GameState = {
    ...gameState,
    status: 'finished',
    winner: survivorId,
    gameReason: 'RESIGNATION'
  };

  saveGameState(updatedGame);

  console.log(`[GAME-LOOP] 🏳️ W.O.! Vencedor por abando: ${survivor?.name}`);
  broadcastGameState(io, updatedGame);

  return updatedGame;
}

async function processMessage(message: SQSMessage, io: SocketIOServer) {
  console.log(`[GAME-LOOP] ⚙️  Processando: ${message.action} (jogador: ${message.playerId || 'server'})`);

  switch (message.action) {
    case 'start_game':  await handleStartGame(message, io);  break;
    case 'play_card':   await handlePlayCard(message, io);   break;
    case 'pass_turn':   await handlePassTurn(message, io);   break;
    case 'draw_piece':  await handleDrawPiece(message, io);  break;
    default:
      console.log(`[GAME-LOOP] ⚠️  Ação desconhecida: ${message.action}`);
  }
}

// ============================================
// Start the in-process game loop
// Polls the SAME sqsService instance used by index.ts
// ============================================
export function startGameLoop(sqsService: ISQSService, io: SocketIOServer, rooms: Map<string, Room>) {
  _rooms = rooms; // Injeta referência para o gameLoop atualizar room.gameId
  console.log(`
╔════════════════════════════════════════╗
║  🔄 Game Loop integrado ao Server     ║
║  Processando fila SQS a cada 500ms    ║
╚════════════════════════════════════════╝
  `);

  const pollInterval = setInterval(async () => {
    try {
      const messages = await sqsService.receiveMessages(10);

      for (const message of messages) {
        try {
          await processMessage(message, io);
        } catch (err) {
          console.error(`[GAME-LOOP] ❌ Erro ao processar mensagem ${message.action}:`, err);
        }

        // Remove da fila após processar
        const receiptHandle = (message as any)._receiptHandle;
        if (receiptHandle) {
          await sqsService.deleteMessage(receiptHandle);
        } else {
          // LocalSQSService não atribui _receiptHandle na receção, então limpamos manualmente
          await sqsService.purgeQueue();
        }
      }
    } catch (error) {
      console.error('[GAME-LOOP] ❌ Erro no poll:', error);
    }
  }, 500);

  return pollInterval;
}
