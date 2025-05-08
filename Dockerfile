# Étape 1 : build TS
FROM node:20-slim AS builder

WORKDIR /app

# Installation des dépendances
COPY package*.json tsconfig.json ./
RUN npm install 

# On copie le schema Prisma
COPY src/prisma ./src/prisma

# On génère le client Prisma
RUN npx prisma generate --schema=src/prisma/schema.prisma

# Copie du code source
COPY src ./src

# Compilation TypeScript
RUN npm run build


# Étape 2 : runtime minimal
FROM node:20-slim AS runner

WORKDIR /app

# On copie uniquement ce dont on a besoin en prod :
# - package.json (pour npm ci)
# - node_modules (seulement prod deps)
# - le JS compilé dans dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/prisma/client ./prisma/client

EXPOSE 5000

# On lance directement le JS compilé.
CMD ["node", "dist/index.js"]
