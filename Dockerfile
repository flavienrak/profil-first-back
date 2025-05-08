# Étape 1 : build TS
FROM node:20-slim AS builder

# Dépendances système minimales
RUN apt-get update && apt-get install -y openssl

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

COPY package*.json ./
RUN npm install

# Copie du code compilé
COPY --from=builder /app/dist ./dist

# Copie du client Prisma (important)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Si tu as besoin du fichier schema.prisma (ex: pour les migrations à runtime)
COPY --from=builder /app/src/prisma ./src/prisma

EXPOSE 5000

# On lance directement le JS compilé.
CMD ["node", "dist/index.js"]
