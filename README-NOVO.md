# 🎲 Dominó Online Multiplayer

## Visão Geral

Um jogo de Dominó Online para 2-4 jogadores com arquitetura **Event-Driven** usando **AWS SQS**, desenvolvido como projeto de **Sistemas Distribuídos**.

### Características Principais

- ✅ **Arquitetura Desacoplada**: API Gateway + Worker Consumer separados
- ✅ **Event-Driven com SQS**: Processamento assíncrono de eventos
- ✅ **Modo Híbrido**: LOCAL (memória) ou AWS (SQS real)
- ✅ **Regras Completas do Dominó**: Hand, Trancado, Carroça
- ✅ **Tempo Real**: Socket.IO para atualização instantânea
- ✅ **Docker Compose**: 3 serviços (Frontend, Backend, Worker)
- ✅ **Logs de Auditoria**: Rastreamento completo de mensagens

## 🏗️ Arquitetura

### Componentes

```
┌─────────────────┐
│  Frontend (React)     │ ◄─── Cliente Web
│  Socket.IO Client     │
└────────┬────────┘
         │
    Socket.IO Events
         │
         ▼
┌─────────────────────────────────┐
│  Backend (Node.js/Express)      │ ◄─── API Gateway
│  Socket.IO Server               │      (Apenas forwarda eventos)
│  Envia para SQS                 │
└────────┬────────────────────────┘
         │
    SQS Messages
         │
         ▼
┌─────────────────────────────────┐
│  SQS Fila (LOCAL ou AWS)        │ ◄─── Event Bus
│  Armazena eventos               │
└────────┬────────────────────────┘
         │
    Poll Messages
         │
         ▼
┌─────────────────────────────────┐
│  Worker (Node.js Consumer)      │ ◄─── "Cérebro" do Jogo
│  Lógica de Dominó               │      (Processa tudo)
│  Atualiza Estado Global         │
└─────────────────────────────────┘
```

## 📋 Regras do Jogo

### Setup
- **28 peças** de dominó (0-0 até 6-6)
- **7 peças** por jogador (2-4 jogadores)
- Resto no **banco** (embaralhado)

### Início
- Primeira jogada: quem tem **6-6** ou **maior peça**
- Ordem: **anti-horária**
- Alternância de **esquerda/direita** da mesa

### Movimentos
1. **Jogar Carta**: Encaixa em esquerda ou direita (com rotação automática)
2. **Passar**: Se não tiver carta válida
3. **Tirar do Banco**: Se passou e há peças no banco

### Vitória
- **Hand**: Zerar a mão = ganha pontos (soma das mãos dos outros)
- **Trancado**: Todos passaram = menor soma ganha
- **Carroça**: 5+ duplas (n-n) = vitória automática

## 🚀 Quick Start

### Modo Desenvolvimento (3 terminais)

```bash
# Terminal 1: API Gateway
npm run dev -w packages/server

# Terminal 2: Worker (SQS Consumer)
npm run worker -w packages/server

# Terminal 3: Frontend
npm run dev -w packages/client
```

**Acesso**: http://localhost:5173

### Modo Docker

```bash
docker-compose up --build
```

**URLs**:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## 📊 Estrutura de Dados

### GameState
```typescript
{
  id: "uuid",
  roomId: "sala-123",
  players: [{
    id: "lb-Pedro",
    name: "Pedro",
    hand: [{ left: 6, right: 4 }, ...],
    score: 0,
    isActive: true
  }],
  board: [{ left: 6, right: 6 }, { left: 6, right: 4 }, ...],
  boardLeft: 6,      // Ponta esquerda
  boardRight: 4,     // Ponta direita
  playerOrder: ["lb-Pedro", "lb-João", ...],
  currentPlayerIndex: 0,
  bank: [{...}, ...], // Peças não distribuídas
  status: "playing",  // waiting | playing | finished
  winner: "lb-Pedro",
  round: 1
}
```

### SQSMessage
```typescript
{
  id: "uuid",
  timestamp: 1234567890,
  action: "play_card",  // start_game | play_card | pass_turn | draw_piece
  playerId: "lb-Pedro",
  gameId: "game-456",
  payload: { /* dados específicos da ação */ }
}
```

## 🔍 Logs e Auditoria

Ao jogar uma carta, você verá no **terminal do Worker**:

```
╔════════════════════════════════════════╗
║ [SQS-CONSUMER] Mensagem recebida       ║
║ Ação: play_card                        ║
║ Jogador: lb-Pedro                      ║
║ Timestamp: 14:30:45                    ║
╚════════════════════════════════════════╝

[SQS-CONSUMER] ✉️  Mensagem recebida: Jogador Pedro jogou a peça 6-4
[SQS-CONSUMER] ✅ Jogador Pedro jogou 6-4 em right
[SQS-CONSUMER] 💾 Estado do jogo salvo: game-uuid
```

## 🔧 Configuração

### .env Local
```env
# Modo LOCAL (sem AWS)
USE_OFFLINE=true
NODE_ENV=development
PORT=3001
VITE_API_URL=http://localhost:3001
```

### .env AWS (EC2)
```env
# Modo AWS SQS
USE_OFFLINE=false
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/domino-queue
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
```

## 📦 Tech Stack

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | React | 18.2.0 |
| Builder | Vite | 5.0.8 |
| Backend | Node.js | 20 LTS |
| Framework | Express | 4.18.2 |
| Real-Time | Socket.IO | 4.7.2 |
| SQS SDK | AWS SDK v3 | 3.410.0 |
| Language | TypeScript | 5.3.3 |

## 📂 Estrutura de Pasta

```
projeto/
├── packages/
│   ├── server/
│   │   ├── src/
│   │   │   ├── index.ts           (API Gateway)
│   │   │   ├── worker.ts          (SQS Consumer)
│   │   │   ├── services/
│   │   │   │   ├── sqsService.ts  (Mock/AWS SQS)
│   │   │   │   └── gameService.ts (Lógica do Dominó)
│   │   │   └── types/
│   │   │       └── index.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── client/
│       ├── src/
│       │   ├── pages/
│       │   │   └── Game.tsx
│       │   ├── styles/
│       │   │   └── game.css
│       │   ├── main.tsx
│       │   └── App.tsx
│       ├── index.html
│       ├── Dockerfile
│       └── package.json
│
├── docker-compose.yml
├── .env.example
├── package.json           (Workspaces)
└── RUNNING.md
```

## 🎯 Fluxo de Execução

### 1️⃣ Cliente conecta
```
Browser → API Gateway (Socket.IO Connect)
```

### 2️⃣ Criar/Entrar Sala
```
Browser.emit('create_room') → API Gateway → Armazena em memória → Emite 'room_updated'
```

### 3️⃣ Iniciar Jogo
```
Browser.emit('start_game') → API Gateway → Envia para SQS → Worker recebe → 
GameService.initializeGame() → Salva GameState → API broadcast 'game_state_updated'
```

### 4️⃣ Jogar Carta
```
Browser.emit('play_card') → API Gateway → Envia para SQS → Worker recebe → 
GameService.playCard() → Valida + Executa → Salva GameState → API broadcast
```

## 🐛 Modo de Depuração

### Verificar Fila LOCAL em Memória

Adicione em `worker.ts`:
```typescript
console.log(`Fila atual: ${sqsService.getQueueLength()} mensagens`);
```

### Verificar Conexão Socket.IO

No **browser console**:
```javascript
// Se conectado
io.connected  // true

// Todos os listeners
io.eventNames()
```

### Verificar GameState

No **terminal do Worker**, adicione logs:
```typescript
console.log(`[GAME STATE]`, JSON.stringify(gameState, null, 2));
```

## 🚀 Deploy na AWS EC2

### 1. Launch EC2 Instance
- **AMI**: Ubuntu 22.04 LTS
- **Type**: t3.medium (2 vCPU, 4GB RAM)
- **Security**: Abrir portas 3001, 5173

### 2. SSH e Instalar Docker
```bash
ssh -i seu-key.pem ubuntu@seu-ec2-ip

# Update
sudo apt update && sudo apt upgrade -y

# Docker
sudo apt install docker.io docker-compose -y
sudo usermod -aG docker ubuntu
```

### 3. Clonar e Rodar
```bash
git clone https://seu-repo domino
cd domino

# Copiar com credenciais AWS
cp .env.example .env
nano .env  # Editar com credenciais reais

# Build e rodar
docker-compose up -d

# Ver logs
docker-compose logs -f worker
```

### 4. Acessar
```
http://seu-ec2-ip:5173
```

## ✅ Requisitos Atendidos

- [x] **Arquitetura Event-Driven**: API Gateway + Worker separados
- [x] **AWS SQS Desacoplada**: Mensagens enfileiradas entre serviços
- [x] **Modo Híbrido LOCAL/AWS**: `USE_OFFLINE` controla modo
- [x] **Build de Produção**: Express serve arquivos estáticos React
- [x] **Docker Compose**: Frontend, Backend, Worker
- [x] **Regras Completas**: 28 peças, 7 por jogador, 3 tipos de vitória
- [x] **Logs de Auditoria**: `[SQS-CONSUMER]` com detalhes da ação
- [x] **Package.json e Dockerfiles**: Tudo pronto para deploy

## 📚 Documentação Adicional

- [RUNNING.md](RUNNING.md) - Guia executável passo a passo
- [AWS SQS Docs](https://docs.aws.amazon.com/sqs/)
- [Socket.IO Guide](https://socket.io/docs/)
- [Docker Compose Docs](https://docs.docker.com/compose/)

## 👥 Autores

- Equipe de Desenvolvimento
- Trabalho de Sistemas Distribuídos

## 📄 Licença

MIT
