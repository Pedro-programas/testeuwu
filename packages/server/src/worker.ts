import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { createSQSService } from './services/sqsService.js';
import { GameService } from './services/gameService.js';
import type { SQSMessage, GameState, Room, Player } from './types/index.js';

const sqsService = createSQSService();

// ============================================
// In-Memory Store (Worker State)
// ============================================
const games: Map<string, GameState> = new Map();
const rooms: Map<string, Room> = new Map();

// ============================================
// Simulação de Redis/Persistência
// ============================================
// Em produção, isso seria Redis ou banco de dados
function saveGameState(gameState: GameState) {
  games.set(gameState.id, gameState);
  console.log(`[SQS-CONSUMER] 💾 Estado do jogo salvo: ${gameState.id}`);
}

function getGameState(gameId: string): GameState | undefined {
  return games.get(gameId);
}

// ============================================
// Message Processing
// ============================================

async function processMessage(message: SQSMessage) {
  console.log(`
╔════════════════════════════════════════╗
║ [SQS-CONSUMER] Mensagem recebida       ║
║ Ação: ${message.action.padEnd(28)} ║
║ Jogador: ${message.playerId.padEnd(26)} ║
║ Timestamp: ${new Date(message.timestamp).toLocaleTimeString()}           ║
╚════════════════════════════════════════╝
  `);

  try {
    switch (message.action) {
      case 'start_game':
        await handleStartGame(message);
        break;

      case 'play_card':
        await handlePlayCard(message);
        break;

      case 'pass_turn':
        await handlePassTurn(message);
        break;

      case 'draw_piece':
        await handleDrawPiece(message);
        break;

      default:
        console.log(`[SQS-CONSUMER] ⚠️  Ação desconhecida: ${message.action}`);
    }
  } catch (error) {
    console.error(`[SQS-CONSUMER] ❌ Erro ao processar mensagem:`, error);
  }
}

// ============================================
// Action Handlers
// ============================================

async function handleStartGame(message: SQSMessage) {
  const { roomId, players } = message.payload;

  if (!roomId || !players) {
    throw new Error('Payload inválido para start_game');
  }

  // Cria uma nova sala em memória
  const room: Room = {
    id: roomId,
    name: `Sala ${roomId.substring(0, 8)}`,
    players: players as Player[],
    maxPlayers: 4,
    status: 'playing',
    createdAt: Date.now()
  };

  rooms.set(roomId, room);

  // Inicializa o jogo
  let gameState = GameService.initializeGame(roomId, players as Player[]);
  gameState = GameService.startGame(gameState);

  room.gameId = gameState.id;
  games.set(gameState.id, gameState);

  console.log(`[SQS-CONSUMER] 🎮 Jogo iniciado: ${gameState.id}`);
  console.log(`[SQS-CONSUMER] 👥 Jogadores: ${(players as Player[]).map((p: Player) => p.name).join(', ')}`);
  console.log(`[SQS-CONSUMER] 📋 Peças no banco: ${gameState.bank.length}`);

  // Aqui em produção seria feito broadcast via Socket.IO
  saveGameState(gameState);
}

async function handlePlayCard(message: SQSMessage) {
  const { gameId, playerId, card, position } = message.payload;

  const gameState = getGameState(gameId);
  if (!gameState) {
    throw new Error(`Jogo não encontrado: ${gameId}`);
  }

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) {
    throw new Error(`Jogador não encontrado: ${playerId}`);
  }

  console.log(`[SQS-CONSUMER] ✉️  Mensagem recebida: Jogador ${player.name} jogou a peça ${card.left}-${card.right}`);

  // Valida movimento
  if (!GameService.isValidMove(gameState, playerId, card, position)) {
    throw new Error(`Movimento inválido: peça ${card.left}-${card.right} não pode ser jogada em ${position}`);
  }

  // Joga a peça
  const updatedGame = GameService.playCard(gameState, {
    gameId,
    playerId,
    card,
    position
  });

  saveGameState(updatedGame);

  // Broadcast (em produção)
  console.log(`[SQS-CONSUMER] 📡 Broadcasting estado atualizado para sala ${updatedGame.roomId}`);
}

async function handlePassTurn(message: SQSMessage) {
  const { gameId, playerId } = message.payload;

  const gameState = getGameState(gameId);
  if (!gameState) {
    throw new Error(`Jogo não encontrado: ${gameId}`);
  }

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) {
    throw new Error(`Jogador não encontrado: ${playerId}`);
  }

  console.log(`[SQS-CONSUMER] 📬 ${player.name} passou a vez`);

  const updatedGame = GameService.passTurn(gameState, { gameId, playerId });
  saveGameState(updatedGame);
}

async function handleDrawPiece(message: SQSMessage) {
  const { gameId, playerId } = message.payload;

  const gameState = getGameState(gameId);
  if (!gameState) {
    throw new Error(`Jogo não encontrado: ${gameId}`);
  }

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) {
    throw new Error(`Jogador não encontrado: ${playerId}`);
  }

  console.log(`[SQS-CONSUMER] 🎲 ${player.name} está tirando uma peça do banco...`);

  const updatedGame = GameService.drawPiece(gameState, { gameId, playerId });
  saveGameState(updatedGame);
}

// ============================================
// Main Consumer Loop
// ============================================

async function startConsumer() {
  console.log(`
╔════════════════════════════════════════╗
║  🔄 SQS Consumer Worker Iniciado       ║
║  Escutando mensagens...                ║
╚════════════════════════════════════════╝
  `);

  // Poll messages a cada 2 segundos
  const pollInterval = setInterval(async () => {
    try {
      const messages = await sqsService.receiveMessages(10);

      if (messages.length > 0) {
        for (const message of messages) {
          await processMessage(message);

          // Delete message from queue (em LOCAL mode, isto é simulado)
          if ((message as any)._receiptHandle) {
            await sqsService.deleteMessage((message as any)._receiptHandle);
          }
        }
      }
    } catch (error) {
      console.error('[SQS-CONSUMER] ❌ Erro ao receber mensagens:', error);
    }
  }, 2000);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[SQS-CONSUMER] 🛑 SIGTERM recebido, encerrando...');
    clearInterval(pollInterval);
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('[SQS-CONSUMER] 🛑 SIGINT recebido, encerrando...');
    clearInterval(pollInterval);
    process.exit(0);
  });
}

startConsumer().catch(error => {
  console.error('[SQS-CONSUMER] ❌ Erro fatal:', error);
  process.exit(1);
});
