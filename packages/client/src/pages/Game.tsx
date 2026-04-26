import React, { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import type { GameState, Domino, Player, Room } from '../types/index';
import '../styles/game.css';

interface GameProps {
  roomId?: string;
  playerId?: string;
}

export const Game: React.FC = () => {
  const socketRef = useRef<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [isJoined, setIsJoined] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Domino | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');

  // ============================================
  // Socket.IO Connection
  // ============================================
  useEffect(() => {
    const serverUrl = window.location.origin;
    console.log(`[CLIENT] 🔌 Conectando a: ${serverUrl}`);

    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`[CLIENT] ✅ Conectado ao servidor (socket: ${socket.id})`);
      setConnectionStatus('connected');
      setMessage('Conectado ao servidor');
    });

    socket.on('connect_error', (err) => {
      console.error('[CLIENT] ❌ Erro de conexão:', err.message);
      setConnectionStatus('disconnected');
      setMessage(`Erro de conexão: ${err.message}`);
    });

    socket.on('room_updated', (updatedRoom: Room) => {
      console.log('[CLIENT] 🏠 room_updated recebido:', updatedRoom);
      setRoom(updatedRoom);
    });

    socket.on('game_state_updated', (updatedGameState: GameState) => {
      console.log('[CLIENT] 🎮 game_state_updated recebido:', updatedGameState);
      setGameState(updatedGameState);
    });

    socket.on('game_over', (data: { winnerId: string; winnerName: string; reason: string }) => {
      console.log('[CLIENT] 🏆 game_over recebido:', data);
      const reasonLabels: Record<string, string> = {
        NORMAL_WIN: '🏆 Vitória Normal (zerou a mão)',
        BLOCKED: '🔒 Jogo Trancado (menor pontuação vence)',
        RESIGNATION: '🏳️ W.O. (adversário abandonou)',
        CARROÇA: '🎰 Vitória por Carroça (5+ duplas)',
      };
      const label = reasonLabels[data.reason] || data.reason;
      setMessage(`${label} — Vencedor: ${data.winnerName}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[CLIENT] ❌ Desconectado: ${reason}`);
      setConnectionStatus('disconnected');
      setMessage(`Desconectado: ${reason}`);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // ============================================
  // Join / Create Room
  // ============================================
  const handleCreateRoom = () => {
    if (!playerName.trim()) { alert('Digite seu nome!'); return; }
    if (!socketRef.current || connectionStatus !== 'connected') {
      alert('Aguarde a conexão com o servidor...');
      return;
    }
    setLoading(true);
    const roomName = `Sala de ${playerName}`;
    socketRef.current.emit(
      'create_room',
      { roomName, playerName },
      (response: { success: boolean; roomId?: string; playerId?: string; error?: string }) => {
        setLoading(false);
        if (response.success && response.playerId && response.roomId) {
          setMyPlayerId(response.playerId);
          setIsJoined(true);
          console.log(`[CLIENT] 🏠 Sala criada: ${response.roomId}. playerId: ${response.playerId}`);
        } else {
          setMessage(`Erro: ${response.error || 'Desconhecido'}`);
        }
      }
    );
  };

  const handleJoinRoom = () => {
    if (!playerName.trim()) { alert('Digite seu nome!'); return; }
    if (!roomIdInput.trim()) { alert('Digite o ID da sala!'); return; }
    if (!socketRef.current || connectionStatus !== 'connected') {
      alert('Aguarde a conexão com o servidor...');
      return;
    }
    setLoading(true);
    socketRef.current.emit(
      'join_room',
      { roomId: roomIdInput.trim(), playerName },
      (response: { success: boolean; roomId?: string; playerId?: string; error?: string }) => {
        setLoading(false);
        if (response.success && response.playerId) {
          setMyPlayerId(response.playerId);
          setIsJoined(true);
          console.log(`[CLIENT] 👥 Entrei na sala: ${response.roomId}. playerId: ${response.playerId}`);
        } else {
          setMessage(`Erro: ${response.error || 'Sala não encontrada'}`);
        }
      }
    );
  };

  // ============================================
  // Game Actions
  // ============================================
  const handleStartGame = () => {
    if (!room || !socketRef.current) return;
    if (room.players.length < 2) {
      alert('Precisamos de pelo menos 2 jogadores para iniciar!');
      return;
    }

    setLoading(true);
    socketRef.current.emit(
      'start_game',
      { roomId: room.id },
      (response: { success: boolean; error?: string }) => {
        setLoading(false);
        if (response.success) {
          setMessage('Jogo iniciando... aguardando estado do servidor.');
        } else {
          alert(`Erro: ${response.error}`);
        }
      }
    );
  };

  const handlePlayCard = (card: Domino, position: 'left' | 'right') => {
    if (!gameState || !socketRef.current || !myPlayerId) return;

    setLoading(true);
    socketRef.current.emit(
      'play_card',
      { gameId: gameState.id, playerId: myPlayerId, card, position },
      (response: { success: boolean; error?: string }) => {
        setLoading(false);
        if (response.success) {
          setSelectedCard(null);
          setMessage(`Peça jogada: ${card.left}-${card.right}`);
        } else {
          alert(`Erro: ${response.error}`);
        }
      }
    );
  };

  const handlePassTurn = () => {
    if (!gameState || !socketRef.current || !myPlayerId) return;
    setLoading(true);
    socketRef.current.emit(
      'pass_turn',
      { gameId: gameState.id, playerId: myPlayerId },
      (response: { success: boolean; error?: string }) => {
        setLoading(false);
        if (!response.success) alert(`Erro: ${response.error}`);
        else setMessage('Turno passado.');
      }
    );
  };

  const handleDrawPiece = () => {
    if (!gameState || !socketRef.current || !myPlayerId) return;
    setLoading(true);
    socketRef.current.emit(
      'draw_piece',
      { gameId: gameState.id, playerId: myPlayerId },
      (response: { success: boolean; error?: string }) => {
        setLoading(false);
        if (!response.success) alert(`Erro: ${response.error}`);
        else setMessage('Peça retirada do banco.');
      }
    );
  };

  // ============================================
  // Render
  // ============================================

  // Tela de entrada no jogo
  if (!isJoined) {
    const connLabel = connectionStatus === 'connected' ? '🟢 Servidor conectado' : '🟡 Conectando...';
    const connColor = connectionStatus === 'connected' ? '#4caf50' : '#f80';

    // Tela: menu principal
    if (mode === 'menu') {
      return (
        <div className="join-container">
          <div className="join-card">
            <h1>🎲 Dominó Online</h1>
            <p>Jogo Multiplayer com AWS SQS &mdash; UFERSA</p>
            <p style={{ fontSize: '0.8rem', color: connColor }}>{connLabel}</p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setMode('create')} style={{ flex: 1 }}>➕ Criar Sala</button>
              <button onClick={() => setMode('join')} style={{ flex: 1, background: '#1565c0' }}>🚪 Entrar em Sala</button>
            </div>
            <p className="info">{message}</p>
          </div>
        </div>
      );
    }

    // Tela: criar sala
    if (mode === 'create') {
      return (
        <div className="join-container">
          <div className="join-card">
            <h1>🎲 Criar Nova Sala</h1>
            <p style={{ fontSize: '0.8rem', color: connColor }}>{connLabel}</p>
            <input
              type="text"
              placeholder="Seu nome (ex: Pedro)"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleCreateRoom()}
            />
            <button onClick={handleCreateRoom} disabled={loading || connectionStatus !== 'connected'}>
              {loading ? 'Criando...' : '✅ Criar Sala'}
            </button>
            <button onClick={() => setMode('menu')} style={{ background: '#555', marginTop: '8px' }}>← Voltar</button>
            <p className="info">{message}</p>
          </div>
        </div>
      );
    }

    // Tela: entrar em sala existente
    return (
      <div className="join-container">
        <div className="join-card">
          <h1>👥 Entrar em Sala</h1>
          <p style={{ fontSize: '0.8rem', color: connColor }}>{connLabel}</p>
          <input
            type="text"
            placeholder="Seu nome (ex: Ana)"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
          />
          <input
            type="text"
            placeholder="ID da Sala (cole aqui)"
            value={roomIdInput}
            onChange={e => setRoomIdInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleJoinRoom()}
            style={{ marginTop: '8px', fontFamily: 'monospace', fontSize: '0.85rem' }}
          />
          <button onClick={handleJoinRoom} disabled={loading || connectionStatus !== 'connected'}>
            {loading ? 'Entrando...' : '🚀 Entrar na Sala'}
          </button>
          <button onClick={() => setMode('menu')} style={{ background: '#555', marginTop: '8px' }}>← Voltar</button>
          <p className="info">{message}</p>
        </div>
      </div>
    );
  }

  // Aguardando gameState chegar pelo socket
  if (!gameState || !gameState.board) {
    return (
      <div className="game-container">
        <header className="game-header">
          <h1>🎲 Dominó Online</h1>
          <div className="player-info">
            <span>👤 {playerName}</span>
            <span>🎮 Sala: {room?.id?.substring(0, 8)}</span>
          </div>
        </header>

        <main className="game-main">
          <div className="waiting-container">
            <h2>Sala de Espera</h2>

            {/* ID da sala em destaque para copiar e compartilhar */}
            {room && (
              <div style={{
                background: '#1a237e',
                border: '2px solid #42a5f5',
                borderRadius: '8px',
                padding: '12px 16px',
                margin: '12px 0',
                textAlign: 'center'
              }}>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#90caf9' }}>ID da Sala (compartilhe com os amigos):</p>
                <p style={{
                  margin: '4px 0 0',
                  fontFamily: 'monospace',
                  fontSize: '0.95rem',
                  color: '#fff',
                  wordBreak: 'break-all',
                  cursor: 'pointer'
                }}
                  onClick={() => { navigator.clipboard?.writeText(room.id); setMessage('✅ ID copiado!'); }}
                  title="Clique para copiar"
                >
                  {room.id} 📋
                </p>
              </div>
            )}

            <p>Jogadores na sala ({room?.players?.length ?? 0}/{room?.maxPlayers ?? 4}):</p>
            <ul>
              {(room?.players || []).map((p: Player) => (
                <li key={p.id}>
                  {p.id === myPlayerId ? '👉 ' : '👤 '}{p.name}
                  {p.id === myPlayerId ? ' (você)' : ''}
                </li>
              ))}
            </ul>
            {room && (room.players?.length ?? 0) >= 2 && (
              <button onClick={handleStartGame} className="btn-primary" disabled={loading}>
                {loading ? 'Iniciando...' : '▶️ Iniciar Jogo'}
              </button>
            )}
            {room && (room.players?.length ?? 0) < 2 && (
              <p style={{ color: '#aaa', marginTop: '10px' }}>
                Compartilhe o ID da sala com um amigo para ele entrar.
              </p>
            )}
          </div>
        </main>

        <footer className="game-footer">
          <p>{message}</p>
        </footer>
      </div>
    );
  }

  // Jogo ativo - gameState e board garantidamente existem aqui
  const currentPlayer = gameState.players.find((p: Player) => p.id === myPlayerId);
  const isCurrentTurn = gameState.playerOrder[gameState.currentPlayerIndex] === myPlayerId;

  return (
    <div className="game-container">
      <header className="game-header">
        <h1>🎲 Dominó Online</h1>
        <div className="player-info">
          <span>👤 {playerName}</span>
          <span>🎮 Sala: {room?.id?.substring(0, 8)}</span>
          <span style={{ color: isCurrentTurn ? '#4caf50' : '#aaa' }}>
            {isCurrentTurn ? '⚡ Seu turno!' : '⏳ Aguardando...'}
          </span>
        </div>
      </header>

      <main className="game-main">
        {gameState.status === 'finished' ? (
          <div className="finished-container">
            <h2>🏆 Jogo Finalizado!</h2>
            <p>Vencedor: {gameState.players.find((p: Player) => p.id === gameState.winner)?.name ?? 'Desconhecido'}</p>
          </div>
        ) : (
          <>
            {/* Board */}
            <section className="board-section">
              <h3>Mesa</h3>
              <div className="board">
                {gameState.board.length === 0 ? (
                  <p>Nenhuma peça na mesa ainda</p>
                ) : (
                  <div className="dominos-line">
                    {gameState.board.map((domino: Domino, idx: number) => (
                      <div key={idx} className="domino">
                        <div className="dot-left">{domino.left}</div>
                        <div className="divider"></div>
                        <div className="dot-right">{domino.right}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="board-info">
                <span>🏦 Banco: {gameState.bank?.length ?? 0} peças</span>
                <span>📊 Rodada: {gameState.round ?? 0}</span>
              </div>
            </section>

            {/* Players Info */}
            <section className="players-section">
              <h3>Jogadores</h3>
              <div className="players-list">
                {gameState.players.map((player: Player) => (
                  <div
                    key={player.id}
                    className={`player-card ${
                      gameState.playerOrder[gameState.currentPlayerIndex] === player.id ? 'current-turn' : ''
                    }`}
                  >
                    <div className="player-name">
                      {player.id === myPlayerId ? '👉 ' : '👤 '}
                      {player.name}
                      {player.id === myPlayerId ? ' (você)' : ''}
                    </div>
                    <div className="player-stats">
                      <span>🂡 Peças: {player.hand?.length ?? 0}</span>
                      <span>📍 Pontos: {player.score ?? 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Player Hand */}
            {currentPlayer && (
              <section className="hand-section">
                <h3>Sua Mão ({currentPlayer.hand?.length ?? 0} peças)</h3>
                <div className="hand">
                  {!currentPlayer.hand || currentPlayer.hand.length === 0 ? (
                    <p>Você zerou sua mão! 🎉</p>
                  ) : (
                    currentPlayer.hand.map((domino: Domino, idx: number) => (
                      <div
                        key={idx}
                        className={`domino-selectable ${
                          selectedCard?.left === domino.left && selectedCard?.right === domino.right
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() => setSelectedCard(domino)}
                      >
                        <div className="dot-left">{domino.left}</div>
                        <div className="divider"></div>
                        <div className="dot-right">{domino.right}</div>
                      </div>
                    ))
                  )}
                </div>

                {isCurrentTurn && selectedCard && (
                  <div className="action-buttons">
                    <button
                      onClick={() => handlePlayCard(selectedCard, 'left')}
                      disabled={loading}
                      className="btn-play"
                    >
                      ⬅️ Jogar à Esquerda
                    </button>
                    <button
                      onClick={() => handlePlayCard(selectedCard, 'right')}
                      disabled={loading}
                      className="btn-play"
                    >
                      Jogar à Direita ➡️
                    </button>
                    <button onClick={() => setSelectedCard(null)} className="btn-action">
                      ✖️ Cancelar
                    </button>
                  </div>
                )}

                {isCurrentTurn && !selectedCard && (
                  <div className="action-buttons">
                    <button onClick={handleDrawPiece} disabled={loading} className="btn-action">
                      🎲 Tirar do Banco
                    </button>
                    <button onClick={handlePassTurn} disabled={loading} className="btn-action">
                      ⏭️ Passar Turno
                    </button>
                  </div>
                )}

                {!isCurrentTurn && (
                  <div className="waiting-turn">
                    <p>Aguardando o turno de {gameState.players.find((p: Player) => p.id === gameState.playerOrder[gameState.currentPlayerIndex])?.name}...</p>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <footer className="game-footer">
        <p>{message}</p>
      </footer>
    </div>
  );
};

export default Game;
