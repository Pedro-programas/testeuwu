import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';

import { createSQSService } from './services/sqsService.js';
import { startGameLoop, games, checkAndApplyWalkover } from './gameLoop.js';
import type {
  SQSMessage,
  Room,
  Player,
  GameState,
  PlayCardPayload,
  PassTurnPayload,
  DrawPiecePayload
} from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*' }
});

// Uma única instância de sqsService compartilhada com o gameLoop
const sqsService = createSQSService();
const PORT = parseInt(process.env.PORT || '3001', 10);
const VITE_DEV_SERVER = process.env.VITE_DEV_SERVER === 'true';

// ============================================
// In-Memory Store (Server-side State)
// ============================================
const rooms: Map<string, Room> = new Map();
const playerSockets: Map<string, string> = new Map(); // playerId -> socketId

// ============================================
// Middleware
// ============================================
app.use(express.json());

// Serve os arquivos estáticos do React (produção)
if (!VITE_DEV_SERVER) {
  const clientBuildPath = join(__dirname, '../../client/dist');
  app.use(express.static(clientBuildPath));
  // SPA fallback: todas as rotas não-API servem o index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      res.sendFile(join(clientBuildPath, 'index.html'));
    }
  });
  console.log(`[SERVER] 📁 Servindo cliente de: ${clientBuildPath}`);
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// Socket.IO Events
// ============================================

io.on('connection', (socket) => {
  console.log(`[SERVER] 👤 Cliente conectado: ${socket.id}`);

  // ========================================
  // Gerenciamento de Salas
  // ========================================

  socket.on('create_room', (data: { roomName: string; playerName: string }, callback) => {
    const roomId = uuidv4();
    const playerId = `player-${uuidv4().substring(0, 8)}`;

    const newRoom: Room = {
      id: roomId,
      name: data.roomName,
      players: [{ id: playerId, name: data.playerName, hand: [], score: 0, isActive: true }],
      maxPlayers: 4,
      status: 'waiting',
      createdAt: Date.now()
    };

    rooms.set(roomId, newRoom);
    playerSockets.set(playerId, socket.id);

    socket.join(roomId);
    console.log(`[SERVER] 🏠 Sala criada: ${roomId} por ${data.playerName} (playerId: ${playerId})`);

    callback({ success: true, roomId, playerId });
    // Emite room_updated para que o cliente atualize a lista de jogadores
    io.to(roomId).emit('room_updated', newRoom);
  });

  socket.on('join_room', (data: { roomId: string; playerName: string }, callback) => {
    const room = rooms.get(data.roomId);

    if (!room) {
      callback({ success: false, error: 'Sala não encontrada' });
      return;
    }

    if (room.players.length >= room.maxPlayers) {
      callback({ success: false, error: 'Sala cheia' });
      return;
    }

    const playerId = `player-${uuidv4().substring(0, 8)}`;
    const newPlayer: Player = { id: playerId, name: data.playerName, hand: [], score: 0, isActive: true };

    room.players.push(newPlayer);
    playerSockets.set(playerId, socket.id);

    socket.join(data.roomId);
    console.log(`[SERVER] 👥 ${data.playerName} entrou na sala ${data.roomId} (playerId: ${playerId})`);

    callback({ success: true, roomId: data.roomId, playerId });
    io.to(data.roomId).emit('room_updated', room);
  });

  socket.on('start_game', (data: { roomId: string }, callback) => {
    const room = rooms.get(data.roomId);

    if (!room || room.players.length < 2) {
      callback({ success: false, error: 'Sala precisa de pelo menos 2 jogadores' });
      return;
    }

    room.status = 'playing';
    rooms.set(data.roomId, room);

    // Envia para a fila SQS (mesma instância do gameLoop)
    const message: SQSMessage = {
      id: uuidv4(),
      timestamp: Date.now(),
      action: 'start_game',
      playerId: '',
      gameId: '',
      payload: { roomId: data.roomId, players: room.players }
    };

    sqsService.sendMessage(message).then(() => {
      console.log(`[SERVER] 📨 Mensagem start_game enviada para fila`);
      callback({ success: true, message: 'Jogo iniciando...' });
    }).catch(err => {
      console.error(`[SERVER] ❌ Erro ao enviar start_game:`, err);
      callback({ success: false, error: 'Erro interno' });
    });
  });

  // ========================================
  // Eventos do Jogo
  // ========================================

  socket.on('play_card', (data: PlayCardPayload, callback) => {
    const message: SQSMessage = {
      id: uuidv4(),
      timestamp: Date.now(),
      action: 'play_card',
      playerId: data.playerId,
      gameId: data.gameId,
      payload: data
    };

    sqsService.sendMessage(message).then(() => {
      callback({ success: true });
    }).catch(error => {
      console.error(`[SERVER] ❌ Erro ao enviar play_card:`, error);
      callback({ success: false, error: (error as Error).message });
    });
  });

  socket.on('pass_turn', (data: PassTurnPayload, callback) => {
    const message: SQSMessage = {
      id: uuidv4(),
      timestamp: Date.now(),
      action: 'pass_turn',
      playerId: data.playerId,
      gameId: data.gameId,
      payload: data
    };

    sqsService.sendMessage(message).then(() => {
      callback({ success: true });
    }).catch(error => {
      callback({ success: false, error: (error as Error).message });
    });
  });

  socket.on('draw_piece', (data: DrawPiecePayload, callback) => {
    const message: SQSMessage = {
      id: uuidv4(),
      timestamp: Date.now(),
      action: 'draw_piece',
      playerId: data.playerId,
      gameId: data.gameId,
      payload: data
    };

    sqsService.sendMessage(message).then(() => {
      callback({ success: true });
    }).catch(error => {
      callback({ success: false, error: (error as Error).message });
    });
  });

  socket.on('disconnect', () => {
    console.log(`[SERVER] 👤 Cliente desconectado: ${socket.id}`);

    // Identifica qual jogador desconectou
    let disconnectedPlayerId: string | null = null;
    let disconnectedRoomId: string | null = null;

    for (const [playerId, socketId] of playerSockets.entries()) {
      if (socketId === socket.id) {
        disconnectedPlayerId = playerId;
        playerSockets.delete(playerId);
        break;
      }
    }

    if (!disconnectedPlayerId) return;

    // Encontra a sala do jogador
    for (const [roomId, room] of rooms.entries()) {
      const isInRoom = room.players.some(p => p.id === disconnectedPlayerId);
      if (isInRoom) {
        disconnectedRoomId = roomId;
        break;
      }
    }

    if (!disconnectedRoomId) return;

    const room = rooms.get(disconnectedRoomId);
    if (!room || room.status !== 'playing' || !room.gameId) return;

    const gameState = games.get(room.gameId);
    if (!gameState || gameState.status !== 'playing') return;

    // Verifica quais jogadores da partida ainda estão conectados
    const activePlayerIds = gameState.players
      .filter(p => playerSockets.has(p.id))
      .map(p => p.id);

    console.log(`[SERVER] ⚠️  Jogador ${disconnectedPlayerId} saiu. Ativos na sala: ${activePlayerIds.length}`);

    // Dispara W.O. se só restar 1 jogador
    checkAndApplyWalkover(gameState, activePlayerIds, io);
  });
});

// ============================================
// Inicia o Game Loop no MESMO processo
// Compartilha a mesma sqsService e io
// ============================================
startGameLoop(sqsService, io, rooms);

// ============================================
// Start Server
// ============================================
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════╗
║   🎲 Dominó Online - API Gateway      ║
║   http://0.0.0.0:${PORT}                  ║
╚════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SERVER] 🛑 SIGTERM recebido, encerrando...');
  httpServer.close(() => {
    console.log('[SERVER] ✅ Servidor encerrado');
    process.exit(0);
  });
});
