import { v4 as uuidv4 } from 'uuid';
import type { GameState, Player, Domino, PlayCardPayload, DrawPiecePayload, PassTurnPayload } from '../types/index.js';

// ============================================
// Utilidades
// ============================================

export class GameService {
  /**
   * Cria as 28 peças de dominó (0-0 até 6-6)
   */
  static createDominoPieces(): Domino[] {
    const pieces: Domino[] = [];
    for (let i = 0; i <= 6; i++) {
      for (let j = i; j <= 6; j++) {
        pieces.push({ left: i, right: j });
      }
    }
    return pieces;
  }

  /**
   * Embaralha um array (Fisher-Yates)
   */
  static shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Inicializa um novo jogo
   */
  static initializeGame(roomId: string, players: Player[]): GameState {
    const dominoes = this.shuffle(this.createDominoPieces());
    const piecesPerPlayer = 7;

    // Distribui peças aos jogadores
    const updatedPlayers = players.map((player, index) => ({
      ...player,
      hand: dominoes.slice(index * piecesPerPlayer, (index + 1) * piecesPerPlayer),
      score: 0,
      isActive: true
    }));

    // Banco contém as peças restantes
    const bank = dominoes.slice(players.length * piecesPerPlayer);

    // Ordem anti-horária (inverso da ordem dos jogadores)
    const playerOrder = players.map(p => p.id).reverse();

    return {
      id: uuidv4(),
      roomId,
      players: updatedPlayers,
      board: [],
      boardLeft: -1,
      boardRight: -1,
      playerOrder,
      currentPlayerIndex: 0,
      bank,
      status: 'waiting',
      consecutivePasses: 0,
      round: 0
    };
  }

  /**
   * Inicia a partida (busca quem tem 6-6 ou maior)
   */
  static startGame(game: GameState): GameState {
    const updated = { ...game };

    // Procura por 6-6
    let startPlayerIndex = -1;
    for (let i = 0; i < updated.players.length; i++) {
      const player = updated.players[i];
      for (const domino of player.hand) {
        if (domino.left === 6 && domino.right === 6) {
          startPlayerIndex = i;
          break;
        }
      }
      if (startPlayerIndex !== -1) break;
    }

    // Se não houver 6-6, procura a maior peça
    if (startPlayerIndex === -1) {
      let maxValue = -1;
      for (let i = 0; i < updated.players.length; i++) {
        for (const domino of updated.players[i].hand) {
          const value = domino.left + domino.right;
          if (value > maxValue) {
            maxValue = value;
            startPlayerIndex = i;
          }
        }
      }
    }

    // Define índice do jogador no playerOrder
    const startPlayerId = updated.players[startPlayerIndex].id;
    updated.currentPlayerIndex = updated.playerOrder.indexOf(startPlayerId);

    // Joga a peça inicial
    const player = updated.players[startPlayerIndex];
    const initialDomino = player.hand.find(d => (d.left === 6 && d.right === 6)) || player.hand[0];

    updated.board = [initialDomino];
    updated.boardLeft = initialDomino.left;
    updated.boardRight = initialDomino.right;

    // Remove a peça da mão do jogador
    player.hand = player.hand.filter(d => !(d.left === initialDomino.left && d.right === initialDomino.right));

    updated.status = 'playing';
    updated.round = 1;

    console.log(`[GAME] 🎲 Jogo iniciado com ${updated.players[startPlayerIndex].name} jogando ${initialDomino.left}-${initialDomino.right}`);

    return updated;
  }

  /**
   * Valida se uma peça pode ser jogada
   */
  static isValidMove(game: GameState, playerId: string, domino: Domino, position: 'left' | 'right'): boolean {
    if (game.board.length === 0) return false;

    const target = position === 'left' ? game.boardLeft : game.boardRight;

    // A peça pode ter qualquer orientação e ser rotacionada
    return domino.left === target || domino.right === target;
  }

  /**
   * Joga uma peça na mesa
   */
  static playCard(game: GameState, payload: PlayCardPayload): GameState {
    const updated = JSON.parse(JSON.stringify(game)) as GameState;
    const player = updated.players.find(p => p.id === payload.playerId);

    if (!player) {
      throw new Error('Jogador não encontrado');
    }

    if (!this.isValidMove(updated, payload.playerId, payload.card, payload.position)) {
      throw new Error('Movimento inválido');
    }

    // Remove a peça da mão
    const cardIndex = player.hand.findIndex(
      d => d.left === payload.card.left && d.right === payload.card.right
    );
    if (cardIndex === -1) {
      throw new Error('Peça não está na mão do jogador');
    }

    player.hand.splice(cardIndex, 1);

    // Adiciona à mesa (com rotação se necessário)
    const target = payload.position === 'left' ? updated.boardLeft : updated.boardRight;
    let dominoToAdd = { ...payload.card };

    if (payload.position === 'left') {
      if (dominoToAdd.right !== target) {
        [dominoToAdd.left, dominoToAdd.right] = [dominoToAdd.right, dominoToAdd.left];
      }
      updated.board.unshift(dominoToAdd);
      updated.boardLeft = dominoToAdd.left;
    } else {
      if (dominoToAdd.left !== target) {
        [dominoToAdd.left, dominoToAdd.right] = [dominoToAdd.right, dominoToAdd.left];
      }
      updated.board.push(dominoToAdd);
      updated.boardRight = dominoToAdd.right;
    }

    console.log(`[SQS-CONSUMER] ✅ Jogador ${player.name} jogou ${dominoToAdd.left}-${dominoToAdd.right} em ${payload.position}`);

    // Verifica vitória
    const victoryResult = this.checkVictory(updated);
    if (victoryResult.hasWinner) {
      updated.status = 'finished';
      updated.winner = victoryResult.winnerId;
      updated.gameReason = victoryResult.reason as GameState['gameReason'];
      console.log(`[GAME] 🏆 Vitória: ${victoryResult.reason}`);
      return updated;
    }

    // Reseta contador de passes ao jogar uma peça
    updated.consecutivePasses = 0;

    // Verifica jogo trancado (banco vazio + nenhum tem jogada)
    if (this.isGameBlocked(updated)) {
      const lockResult = this.checkVictoryByLock(updated);
      updated.status = 'finished';
      updated.winner = lockResult.winnerId;
      updated.gameReason = 'BLOCKED';
      console.log(`[GAME] 🔒 Jogo Trancado após jogada: ${lockResult.reason}`);
      return updated;
    }

    // Próximo turno
    updated.currentPlayerIndex = (updated.currentPlayerIndex + 1) % updated.playerOrder.length;

    return updated;
  }

  /**
   * Passa a vez (passa turno)
   */
  static passTurn(game: GameState, payload: PassTurnPayload): GameState {
    const updated = JSON.parse(JSON.stringify(game)) as GameState;
    console.log(`[SQS-CONSUMER] ⏭️  Jogador ${payload.playerId} passou a vez`);

    // Incrementa contador de passes consecutivos
    updated.consecutivePasses = (updated.consecutivePasses || 0) + 1;

    updated.currentPlayerIndex = (updated.currentPlayerIndex + 1) % updated.playerOrder.length;

    // Verifica jogo trancado: todos os jogadores passaram OU banco vazio + nenhum tem jogada
    const allPassedThisRound = updated.consecutivePasses >= updated.playerOrder.length;
    if (allPassedThisRound || this.isGameBlocked(updated)) {
      const victoryResult = this.checkVictoryByLock(updated);
      updated.status = 'finished';
      updated.winner = victoryResult.winnerId;
      updated.gameReason = 'BLOCKED';
      console.log(`[GAME] 🔒 Jogo Trancado: ${victoryResult.reason}`);
    }

    return updated;
  }

  /**
   * Tira uma peça do banco
   */
  static drawPiece(game: GameState, payload: DrawPiecePayload): GameState {
    const updated = JSON.parse(JSON.stringify(game)) as GameState;
    const player = updated.players.find(p => p.id === payload.playerId);

    if (!player) {
      throw new Error('Jogador não encontrado');
    }

    if (updated.bank.length === 0) {
      console.log(`[GAME] 📭 Banco vazio. Passando turno.`);
      return this.passTurn(updated, { gameId: game.id, playerId: payload.playerId });
    }

    const drawnCard = updated.bank.shift();
    if (!drawnCard) {
      throw new Error('Erro ao tirar peça do banco');
    }

    player.hand.push(drawnCard);
    console.log(`[SQS-CONSUMER] 🎲 Jogador ${player.name} tirou ${drawnCard.left}-${drawnCard.right} do banco`);

    // Reseta contador de passes ao tirar do banco
    updated.consecutivePasses = 0;

    // Próximo turno
    updated.currentPlayerIndex = (updated.currentPlayerIndex + 1) % updated.playerOrder.length;

    // Verifica jogo trancado após compra
    if (this.isGameBlocked(updated)) {
      const lockResult = this.checkVictoryByLock(updated);
      updated.status = 'finished';
      updated.winner = lockResult.winnerId;
      updated.gameReason = 'BLOCKED';
      console.log(`[GAME] 🔒 Jogo Trancado após compra: ${lockResult.reason}`);
    }

    return updated;
  }

  /**
   * Verifica vitória por Hand (zerou a mão)
   */
  static checkVictory(game: GameState): { hasWinner: boolean; winnerId?: string; reason?: string } {
    for (const player of game.players) {
      // Vitória por Hand (zerou a mão)
      if (player.hand.length === 0) {
        const totalPoints = game.players
          .filter(p => p.id !== player.id)
          .reduce((sum, p) => sum + this.sumDominoValues(p.hand), 0);

        return {
          hasWinner: true,
          winnerId: player.id,
          reason: 'NORMAL_WIN'
        };
      }

      // Vitória por Carroça (5+ peças duplas na mão)
      const doubleCount = player.hand.filter(d => d.left === d.right).length;
      if (doubleCount >= 5) {
        return {
          hasWinner: true,
          winnerId: player.id,
          reason: 'CARROÇA'
        };
      }
    }

    return { hasWinner: false };
  }

  /**
   * Verifica vitória por Trancado (todos passaram)
   */
  static checkVictoryByLock(game: GameState): { winnerId: string; reason: string } {
    let minSum = Infinity;
    let winnerId = '';

    for (const player of game.players) {
      const sum = this.sumDominoValues(player.hand);
      if (sum < minSum) {
        minSum = sum;
        winnerId = player.id;
      }
    }

    const winner = game.players.find(p => p.id === winnerId);
    return {
      winnerId,
      reason: `Trancado: ${winner?.name} vence com ${minSum} pontos`
    };
  }

  /**
   * Soma os valores das peças
   */
  static sumDominoValues(dominos: Domino[]): number {
    return dominos.reduce((sum, d) => sum + d.left + d.right, 0);
  }

  /**
   * Detecta jogo REALMENTE trancado:
   * banco vazio E nenhum jogador tem peça jogavel
   */
  static isGameBlocked(game: GameState): boolean {
    if (game.bank.length > 0) return false; // ainda pode comprar
    return game.players.every(p => !this.hasValidMove(game, p.id));
  }

  /**
   * Verifica se todos os jogadores passaram (contador circular)
   * Mantido por compatibilidade; a lógica real usa consecutivePasses
   */
  static checkIfAllPassed(game: GameState): boolean {
    return (game.consecutivePasses || 0) >= game.playerOrder.length;
  }

  /**
   * Valida se um jogador tem peças válidas
   */
  static hasValidMove(game: GameState, playerId: string): boolean {
    const player = game.players.find(p => p.id === playerId);
    if (!player) return false;

    return player.hand.some(domino =>
      domino.left === game.boardLeft ||
      domino.right === game.boardLeft ||
      domino.left === game.boardRight ||
      domino.right === game.boardRight
    );
  }

  /**
   * Próximo jogador
   */
  static getNextPlayer(game: GameState): Player {
    const nextIndex = (game.currentPlayerIndex + 1) % game.playerOrder.length;
    const playerId = game.playerOrder[nextIndex];
    return game.players.find(p => p.id === playerId)!;
  }
}
