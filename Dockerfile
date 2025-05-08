# Étape 1 : build TS
FROM node:20-slim AS builder

WORKDIR /app

# 1. Install des dépendances
COPY package*.json tsconfig.json ./
RUN npm install 

# 2. Génération Prisma
COPY src/prisma ./prisma
RUN npx prisma generate --schema=prisma/schema.prisma

# 3. Copie du code source
COPY src ./src

# 4. Compilation TypeScript
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
COPY --from=builder /app/src/prisma ./src/prisma

EXPOSE 5000

# On lance directement le JS compilé.
CMD ["node", "dist/index.js"]
