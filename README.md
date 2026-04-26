# 🎲 Dominó Online Multiplayer

Um jogo de dominó online em tempo real para 2-4 jogadores, construído com Node.js, React e Socket.IO.

## 📋 Especificações do Jogo

### Funcionamento Geral

#### Setup Inicial
- Todas as 28 peças de dominó são aleatorizadas na mesa (viradas para baixo)
- Cada jogador seleciona **7 peças** para sua mão (quantidade configurável)
- As peças na mão do jogador são **privadas** (apenas ele vê)

#### Início da Partida
- A partida começa com quem tiver a peça **6-6** ou a **maior peça disponível** na mão
- Ordem de turno: **anti horário**

### Mecânica de Turno

Cada jogador tem **4 opções**:
1. **Passar a vez** - Se não tiver peça válida(Precisa de válidação)
2. **Jogar peça na ponta direita** - Se a peça corresponder com a ponta direita da mesa
3. **Jogar peça na ponta esquerda** - Se a peça corresponder com a ponta esquerda da mesa
4. **Puxar peça do banco** - Se não tiver peça válida, puxa uma aleatória até encontrar uma correspondete para a esquerda ou direita 

### Condições de Vitória

1. **Vitória por Hand**: Um jogador jogou **todas as suas peças**
   - Jogador recebe pontos = soma das peças dos demais jogadores

2. **Vitória por Trancado**: Todos os jogadores passaram a vez (ninguém tem peça válida)
   - Ganha: jogador com a **menor soma** de peças na mão
   - Perdedor: jogador com a **maior soma** de peças

3. **Vitória por Carroça**: Caso um jogador tenha em sua mão 5 peças ou mais com o valor **n-n** ele vence automaticamente a partida 

### Modos de Jogo

- **Clássico**: Primeira pessoa a zerar ganha
- **Mexicano**: Jogo até atingir pontuação máxima (configurável)

## 🎯 Divisão de Etapas

### **Fase 1: Setup Base** ✅ (Em Progresso)
- ✅ Configuração do repositório e ambiente
- ✅ Setup Node.js + Express + TypeScript
- ✅ Setup React + Vite + TypeScript
- ✅ Definição de tipos base (Game, Player, Room, Domino)
- ✅ Configuração Socket.IO (servidor e cliente)
- ✅ Docker + Docker Compose

### **Fase 2: Lógica do Jogo Core** 🔄 (Próxima)
- [ ] GameService: lógica de movimentos e validação
- [ ] Inicialização de jogo (embaralhar peças, distribuir)
- [ ] Validação de movimentos (peça válida, mano válida)
- [ ] Sistema de turnos (próximo jogador, ordem)
- [ ] Verificação de vitória (hand, trancado)
- [ ] Sistema de pontuação

### **Fase 3: Gerenciamento de Salas** ✅ (Completa)
- ✅ RoomService: criar, entrar, listar salas
- ✅ Persistência em memória de salas e jogadores
- ✅ Broadcast de estado para todos clientes
- ✅ Tratamento de desconexão
- ✅ Integração AWS SQS para sincronização distribuída
- ✅ Socket.IO handlers completos

### **Fase 4: Backend - Socket.IO Handlers**
- [ ] Handler: `create_room`
- [ ] Handler: `join_room`
- [ ] Handler: `leave_room`
- [ ] Handler: `play_move` (com validação)
- [ ] Handler: `pass_turn`
- [ ] Handler: `draw_piece`

### **Fase 5: Frontend - Páginas (React)**
- [ ] **Home.tsx**: Tela inicial com opções
- [ ] **CreateRoom.tsx**: Criar sala (nome, modo, jogadores)
- [ ] **JoinRoom.tsx**: Entrar em sala (código + nome)
- [ ] **Game.tsx**: Tela principal do jogo

### **Fase 6: Frontend - Componentes UI**
- [ ] **Board.tsx**: Visualização do board (peças em linha)
- [ ] **Player.tsx**: Informações do jogador (mão, peças, pontos)
- [ ] **Hand.tsx**: Display das peças na mão
- [ ] **PlayersList.tsx**: Lista de jogadores e seus status
- [ ] **GameControls.tsx**: Botões (passar, puxar, jogar)

### **Fase 7: Integração Socket.IO**
- [ ] Conectar eventos Socket.IO com handlers do servidor
- [ ] Sincronizar estado do jogo em tempo real
- [ ] Tratamento de erros e validação de lado do cliente
- [ ] Feedback visual (animações, notificações)

### **Fase 8: Testes e Refinamento**
- [ ] Testes unitários (backend: GameService, RoomService)
- [ ] Testes de integração (Socket.IO eventos)
- [ ] Testes E2E (fluxo completo de jogo)
- [ ] Tratamento de edge cases

### **Fase 9: Deploy e DevOps**
- [ ] Build Docker local
- [ ] Docker Compose para dev/prod
- [ ] CI/CD Pipeline (GitHub Actions)
- [ ] Deploy em container (AWS ECS/EC2 ou similar)

### **Fase 10: Polimento e Features Extras** (Opcional)
- [ ] Chat in-game
- [ ] Histórico de partidas
- [ ] Ranking/Leaderboard
- [ ] Sistema de convites
- [ ] Temas e customização

## 🔄 Dependências entre Fases

### Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────────┐
│ Fase 1: Setup Base ✅ (Bloqueante - base para tudo)         │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
    ┌───────────┐  ┌─────────────┐  ┌──────────────────┐
    │ Fase 2    │  │ Fase 3      │  │ Fase 9 (Ops)     │
    │ GameServ. │  │ RoomServ.   │  │ (Paralelo)       │
    │ (Bloqueante)  │ (Paralelo)  │  │                  │
    └─────┬─────┘  └──────┬──────┘  └──────────────────┘
          │                │
          └────────┬───────┘
                   │
                   ▼
          ┌────────────────┐
          │ Fase 4: Handlers│ (Bloqueante - integra 2+3)
          └────────┬───────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
        ▼          ▼          ▼
    ┌────────┐ ┌──────────┐ ┌────────────┐
    │Fase 5  │ │Fase 5 UI │ │Fase 10     │
    │Pages   │ │estático  │ │Features    │
    │(Paralelo)│Fase 6    │ │(Opcional)  │
    └───┬────┘ │(Paralelo)│ └────────────┘
        │      └────┬─────┘
        │           │
        └─────┬─────┘
              │
              ▼
      ┌──────────────────┐
      │ Fase 7: Integração│ (Bloqueante - une tudo)
      └────────┬─────────┘
               │
               ▼
       ┌──────────────────┐
       │ Fase 8: Testes   │ (Bloqueante)
       └────────┬─────────┘
                │
                ▼
       ┌──────────────────┐
       │ Fase 9: Deploy   │ (Final)
       └──────────────────┘
```

### Tabela de Paralelo vs Sequencial

| Fase | Descrição | Tipo | Depende De | Bloqueia | Prioridade |
|------|-----------|------|-----------|----------|-----------|
| **1** | Setup Base | 🔴 Sequencial | - | Tudo | P0 - AGORA |
| **2** | Lógica GameServ. | 🔴 Sequencial | Fase 1 | 4, 7, 8 | P0 - IMEDIATO |
| **3** | RoomService | 🟡 Semi-paralelo | Fase 1 | 4, 7 | P1 - Logo após 2 |
| **4** | Handlers Socket | 🔴 Sequencial | Fases 2, 3 | 7, 8 | P0 - Após 2+3 |
| **5** | Páginas React | 🟡 Semi-paralelo | Fase 1, depois 4 | 7 | P1 - Paralelo com 2 |
| **6** | Componentes UI | 🟡 Semi-paralelo | Fase 5 | 7 | P1 - Paralelo com 2 |
| **9** | Deploy/DevOps | 🟢 Paralelo | Fase 1 | Nada | P2 - Paralelo |
| **7** | Integração Socket | 🔴 Sequencial | Fases 4, 5, 6 | 8 | P0 - Após 4,5,6 |
| **8** | Testes | 🔴 Sequencial | Todas anteriores | 9 | P0 - Antes de deploy |
| **10** | Features Extras | 🟢 Paralelo | Nenhuma | Nada | P3 - Opcional |

### 📊 Estratégia de Desenvolvimento

#### **Próximas Ações (Prioridade Crítica)**

1. **AGORA** ✅ Fase 1 (já feita)
2. **PRÓXIMO** → **Fase 2**: Implementar `GameService`
   - Sem isso, nada funciona
   - Essencial para validar regras

3. **PARALELO A FASE 2**:
   - 📝 Fase 3: `RoomService` (não bloqueia Fase 2)
   - 🎨 Fase 5: Estrutura básica das páginas (sem lógica)
   - 🧩 Fase 6: Componentes estáticos (sem estado)
   - 🐳 Fase 9: Docker/DevOps (completamente independente)

#### **Depois de Fase 2 + 3 Prontos**
- ⚙️ Fase 4: Implementar handlers Socket.IO
- 🔗 Fase 5+6: Conectar com lógica (state management)

#### **Depois de Fase 4 + 5 + 6 Prontos**
- 🔌 Fase 7: Integração completa Socket.IO ↔ Frontend

#### **Finalmente**
- ✅ Fase 8: Testes (precisa de tudo pronto)
- 🚀 Fase 9: Deploy
- 🎉 Fase 10: Features extras (após sucesso das anteriores)

## 🛠 Tech Stack

| Camada | Tecnologia | Versão | Status |
|--------|-----------|--------|--------|
| **Runtime** | Node.js | 20 LTS | ✅ Fixa |
| **Backend Framework** | Express | 4.18.2 | ✅ Fixa |
| **Backend Language** | TypeScript | 5.3.3 | ✅ Fixa |
| **Tempo Real** | Socket.IO | 4.7.2 | ✅ Fixa |
| **Frontend Framework** | React | 18.2.0 | ✅ Fixa |
| **Frontend Builder** | Vite | 5.0.8 | ✅ Fixa |
| **Containerização** | Docker | Latest | ⚠️ Dinâmica |
| **Orquestração** | Docker Compose | Latest | ⚠️ Dinâmica |

## 🔐 Cadeia de Suprimentos

### Versões Fixas (Supply Chain Lock)

**🎯 Política**: Todas as dependências estão com versões **EXATAS** e **FIXAS** até janeiro de 2026.

- ✅ **Sem ^, ~**: Versões explícitas (ex: `4.18.2`, não `^4.18.0`)
- ✅ **Lock File**: `package-lock.json` versionado no Git
- ✅ **Reproduzibilidade**: `npm ci` garante mesmas versões sempre
- ✅ **Segurança**: Rastreabilidade completa de dependências

### Atualizar Dependências

⚠️ **Raro e controlado**. Quando necessário:

```bash
# 1. Avaliar mudança (breaking changes, segurança)
# 2. Especificar versão exata
npm install express@4.19.0  # Exemplo

# 3. Testar completamente
npm run type-check
npm run build
npm run dev

# 4. Commitar com mensagem clara
git add package*.json
git commit -m "chore: update express to 4.19.0 (security fix)"

# 5. Submeter em PR para review
```

### Auditoria de Segurança

```bash
npm audit                    # Verificar vulnerabilidades
npm audit fix --audit-level=moderate  # Corrigir se necessário
```

## 🚀 Como Rodar

### ⚡ Quick Start

```bash
npm install          # Instalar dependências
cp .env.example .env # Configurar ambiente
npm run dev          # Rodar tudo
```

**URLs:**
- Backend: http://localhost:3001
- Frontend: http://localhost:5173

### 📖 Setup Completo

Veja **[SETUP.md](docs/SETUP.md)** para instruções detalhadas incluindo:
- Pré-requisitos
- Configuração de ambiente
- Docker setup
- Troubleshooting

### Build para Produção

```bash
npm run build        # Build completo
npm run type-check   # Validar tipos TypeScript
npm start            # Rodar servidor
```

## 📁 Estrutura do Projeto

```
projeto_01-domino/
├── packages/
│   ├── server/              # Backend Node.js
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types/       # Tipos TypeScript
│   │   │   ├── services/    # Lógica do jogo
│   │   │   └── handlers/    # Socket.IO handlers
│   │   └── package.json
│   │
│   └── client/              # Frontend React
│       ├── src/
│       │   ├── pages/       # Home, CreateRoom, JoinRoom, Game
│       │   ├── components/  # Board, Player, etc
│       │   ├── hooks/       # Custom hooks
│       │   ├── services/    # Socket.IO client
│       │   └── types/       # Tipos compartilhados
│       └── package.json
│
├── docs/
│   ├── ARCHITECTURE.md      # Arquitetura detalhada
│   └── API.md               # Eventos Socket.IO
├── docker-compose.yml
└── README.md               # Este arquivo
```

## 📖 Documentação

- **[SETUP.md](docs/SETUP.md)** - Guia de instalação e configuração
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Arquitetura da aplicação
- **[FASE3-ROOMS.md](docs/FASE3-ROOMS.md)** - 🎯 Gerenciamento de Salas (AWS SQS)
- **[SUPPLY-CHAIN.md](docs/SUPPLY-CHAIN.md)** - Política de versões e cadeia de suprimentos
- **[SUPPLY-CHAIN-RECOVERY.md](docs/SUPPLY-CHAIN-RECOVERY.md)** - 🛡️ Recuperação de ataque março/2026 (4 camadas)
- **[INCIDENT-RESPONSE.md](docs/INCIDENT-RESPONSE.md)** - 🚨 Incident response detalhado
- **[API.md](docs/API.md)** - Eventos e mensagens Socket.IO
- **[Regras do Dominó](README.md#-especificações-do-jogo)** - Especificações completas do jogo

## 👥 Autores

- Anderson Carlos
- Caio Fontes
- Pedro Henrique 

## 📝 Licença

MIT