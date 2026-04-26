# 🎲 Dominó Online - Guia de Execução

## ⚡ Quick Start (Modo Local)

### 1. Instalar Dependências

```bash
npm install
```

Isto irá instalar as dependências de todos os pacotes (server, client) usando npm workspaces.

### 2. Configurar Ambiente

```bash
cp .env.example .env
```

O arquivo `.env` deve conter:
```
USE_OFFLINE=true
NODE_ENV=development
PORT=3001
```

### 3. Rodar em Desenvolvimento (3 terminais)

**Terminal 1 - API Gateway (Server):**
```bash
npm run dev -w packages/server
```
Acesso: http://localhost:3001

**Terminal 2 - SQS Consumer (Worker):**
```bash
npm run worker -w packages/server
```

**Terminal 3 - Frontend (Client):**
```bash
npm run dev -w packages/client
```
Acesso: http://localhost:5173

### 4. Testar no Browser

1. Abra http://localhost:5173
2. Digite um nome (ex: "lb-Pedro")
3. Clique em "Entrar no Jogo"
4. Abra outro aba/janela do navegador
5. Digite outro nome (ex: "lb-João")
6. Clique em "Entrar no Jogo"
7. Clique em "Iniciar Jogo"

## 🐳 Docker Compose (Recomendado para Produção)

```bash
docker-compose up --build
```

Isto irá iniciar:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001
- **Worker**: (rodando silenciosamente)

## 📊 Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│ Cliente (React/Vite)                                        │
│ http://localhost:5173                                       │
│ - Interface do usuário                                      │
│ - Socket.IO client                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                ▼ Socket.IO Events
        
┌─────────────────────────────────────────────────────────────┐
│ API Gateway (Node.js/Express + Socket.IO)                   │
│ http://localhost:3001                                       │
│ - Recebe eventos do cliente                                 │
│ - Envia mensagens para SQS (NÃO PROCESSA LÓGICA)            │
│ - Faz broadcast do estado para clientes                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                ▼ SQS Messages
        
┌─────────────────────────────────────────────────────────────┐
│ SQS Fila (LOCAL = Array em Memória)                         │
│ - Armazena mensagens de eventos do jogo                     │
│ - Desacoplamento entre API e Worker                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                ▼ Poll Messages
        
┌─────────────────────────────────────────────────────────────┐
│ Worker (Node.js - Consumer)                                 │
│ - Escuta SQS continuamente                                  │
│ - PROCESSA toda lógica do dominó                            │
│ - Atualiza estado global                                    │
│ - Envia estado atualizado via API para broadcast           │
└─────────────────────────────────────────────────────────────┘
```

## 🔍 Logs para Auditoria

Quando um jogador jogar uma carta, você verá no terminal do Worker:

```
╔════════════════════════════════════════╗
║ [SQS-CONSUMER] Mensagem recebida       ║
║ Ação: play_card                        ║
║ Jogador: lb-Pedro                      ║
║ Timestamp: 14:30:45                    ║
╚════════════════════════════════════════╝

[SQS-CONSUMER] ✉️  Mensagem recebida: Jogador Pedro jogou a peça 6-4
[SQS-CONSUMER] ✅ Jogador Pedro jogou 6-4 em right
[SQS-CONSUMER] 💾 Estado do jogo salvo: 12345-abcd-efgh
```

## 🎮 Fluxo do Jogo

### 1. Criar/Entrar Sala
- Jogador 1: Cria sala → `lb-Pedro`
- Jogador 2: Entra na sala → `lb-João`
- Jogador 3+: Podem entrar até 4 jogadores

### 2. Iniciar Jogo
- Clique em "Iniciar Jogo" quando tiver 2+ jogadores
- **API Gateway** envia `start_game` para **SQS**
- **Worker** recebe, inicializa 28 peças, distribui 7 para cada
- Começador: quem tem 6-6 ou maior peça

### 3. Jogar Carta
- Selecione uma carta na sua mão
- Clique "Jogar à Esquerda" ou "Direita"
- **API Gateway** envia `play_card` para **SQS**
- **Worker** valida movimento e atualiza mesa
- Todos recebem novo estado

### 4. Fim do Jogo
- **Hand**: Zerar a mão = vitória
- **Trancado**: Todos passarem = menor soma ganha
- **Carroça**: 5+ duplas = vitória automática

## 🚀 Deploy em AWS EC2

### 1. Preparar Imagem Docker

```bash
# Build local
docker-compose build

# Tag para ECR
docker tag domino-backend:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/domino:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/domino:latest
```

### 2. Configurar SQS Real

No `.env`:
```
USE_OFFLINE=false
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/domino-queue
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
```

### 3. Rodar em EC2

```bash
# EC2 Ubuntu
sudo apt update && sudo apt install docker.io docker-compose -y

# Clonar repo
git clone <seu-repo> domino
cd domino

# Copiar .env com credenciais AWS
cp .env.example .env
# Editar .env com valores reais

# Rodar
docker-compose up -d
```

## 📋 Checklist

- [x] Arquitetura Event-Driven com SQS
- [x] Separação clara: API Gateway (sem lógica) + Worker (com lógica)
- [x] Modo híbrido LOCAL/AWS
- [x] Regras completas do dominó
- [x] Logs de auditoria no Worker
- [x] Docker Compose com 3 serviços
- [x] Build de produção com arquivos estáticos
- [x] Socket.IO em tempo real

## 🐛 Troubleshooting

### "Connection refused on port 3001"
```bash
# Porta já em uso
lsof -i :3001
kill -9 <PID>
```

### "SQS Connection timeout"
```bash
# USE_OFFLINE=true está definido? (para modo local)
echo $USE_OFFLINE
```

### "No messages received in Worker"
```bash
# Verifique se o Worker está rodando
npm run worker -w packages/server

# Verifique logs
# O terminal do Worker deve mostrar "Escutando mensagens..."
```

### React não conecta ao Socket.IO
```bash
# Verifique CORS no server/index.ts
# Verifique se Frontend e Backend estão em URLs diferentes
```

## 📞 Suporte

Para questões sobre arquitetura ou AWS SQS, consulte:
- AWS SQS Documentation: https://docs.aws.amazon.com/sqs/
- Socket.IO Documentation: https://socket.io/docs/
- Docker Compose: https://docs.docker.com/compose/

---

**Desenvolvido para trabalho de Sistemas Distribuídos**
