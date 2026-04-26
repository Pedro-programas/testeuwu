#!/bin/bash

# Script para buildar os Dockerfiles

# Build server
cat > packages/server/Dockerfile << 'EOF'
FROM node:20-alpine

WORKDIR /app

# Copiar package.json e lock files
COPY packages/server/package.json packages/server/package-lock.json ./
COPY package.json .

# Instalar dependências
RUN npm ci --workspaces

# Copiar código fonte
COPY packages/server/src ./src
COPY packages/server/tsconfig.json ./

# Build
RUN npm run type-check

EXPOSE 3001

CMD ["npm", "run", "dev"]
EOF

# Build client
cat > packages/client/Dockerfile << 'EOF'
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package files
COPY packages/client/package.json packages/client/package-lock.json ./
COPY package.json .

# Instalar dependências
RUN npm ci --workspaces

# Copiar código
COPY packages/client/src ./src
COPY packages/client/public ./public
COPY packages/client/index.html ./
COPY packages/client/tsconfig.json ./
COPY packages/client/vite.config.ts ./

# Build
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Instalar serve para servir arquivos estáticos
RUN npm install -g serve

# Copiar arquivos buildados
COPY --from=builder /app/dist ./dist

EXPOSE 5173

CMD ["serve", "-s", "dist", "-l", "5173"]
EOF

echo "✅ Dockerfiles criados com sucesso!"
