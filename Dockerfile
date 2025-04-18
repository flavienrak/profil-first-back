# Étape 1 : Builder avec TypeScript
FROM node:20-slim AS builder

# Répertoire de travail
WORKDIR /app

# Installer OpenSSL et libssl-dev
RUN apt update && \
    apt install -y --no-install-recommends \
      openssl \
      libssl-dev && \
    rm -rf /var/lib/apt/lists/*

# Copier les fichiers nécessaires
COPY package*.json tsconfig.json ./
RUN npm install

# Copier le code source
COPY ./src ./src

# Génére le client Prisma
RUN npx prisma generate --schema=src/prisma/schema.prisma

# Compiler TypeScript → JavaScript (dans /dist)
RUN npm run build

# Étape 2 : Exécution en production
FROM node:20-slim AS runner

WORKDIR /app

# Copier les fichiers nécessaires à l'exécution
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src       ./src

# Exposer le port utilisé par Express
EXPOSE 5000

# Commande de démarrage
CMD ["npm", "run", "serve"]
